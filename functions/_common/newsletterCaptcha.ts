import { JsonError } from "@ourworldindata/utils"
import { Env } from "./env.js"

export async function validateNewsletterCaptcha(
    token: string,
    env: Env,
    action: "subscribe" | "request-link"
): Promise<void> {
    if (!env.TURNSTILE_SECRET_KEY) {
        throw new JsonError(
            "Verification is unavailable. Please try again later.",
            503
        )
    }

    let result: { success?: boolean; action?: string }
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
        if (!response.ok) throw new Error("Turnstile verification unavailable")
        result = await response.json()
    } catch {
        throw new JsonError(
            "Verification is unavailable. Please try again later.",
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
