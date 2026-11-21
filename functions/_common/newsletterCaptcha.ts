import { JsonError } from "@ourworldindata/utils"
import { Env } from "./env.js"

/**
 * Siteverify error codes that mean our configuration or Cloudflare is broken,
 * as opposed to a bot, a replayed token or an expired token. They have to be
 * reported as server errors so that Sentry hears about them: every other
 * failure is a 4xx that is deliberately kept out of Sentry.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/#error-codes
 */
const SERVER_SIDE_ERROR_CODES = new Set([
    "missing-input-secret",
    "invalid-input-secret",
    "bad-request",
    "internal-error",
])

interface SiteverifyResult {
    success?: boolean
    action?: string
    "error-codes"?: string[]
}

// TODO: generalise to validateTurnstileToken (action incl. "donate") and
// replace the duplicate isCaptchaValid in functions/donation/donate.ts, which
// has no timeout or action check.
export async function validateNewsletterCaptcha(
    token: string,
    env: Env,
    action: "subscribe" | "request-link"
): Promise<void> {
    if (!env.TURNSTILE_SECRET_KEY) {
        throw new JsonError("TURNSTILE_SECRET_KEY is not configured", 503)
    }

    let result: SiteverifyResult
    try {
        const response = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret: env.TURNSTILE_SECRET_KEY,
                    response: token,
                }),
                signal: AbortSignal.timeout(10000),
            }
        )
        if (!response.ok) {
            throw new Error(
                `Turnstile siteverify responded with HTTP ${response.status}`
            )
        }
        result = await response.json()
    } catch (error) {
        throw new JsonError("Turnstile siteverify request failed", 503, {
            cause: error,
        })
    }

    const serverSideErrorCodes = (result?.["error-codes"] ?? []).filter(
        (code) => SERVER_SIDE_ERROR_CODES.has(code)
    )
    if (serverSideErrorCodes.length > 0) {
        throw new JsonError(
            `Turnstile siteverify reported ${serverSideErrorCodes.join(", ")}`,
            503
        )
    }

    // Dummy tokens don't preserve the widget action: live responses can omit
    // it entirely, while Cloudflare's documentation shows action: "test".
    // Only the public always-pass test secret is exempt from action validation.
    const isUsingTestSecretKey =
        env.TURNSTILE_SECRET_KEY === "1x0000000000000000000000000000000AA"
    if (
        result?.success !== true ||
        (!isUsingTestSecretKey && result.action !== action)
    ) {
        throw new JsonError("Verification failed. Please try again.", 400)
    }
}
