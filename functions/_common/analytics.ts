// This file is mirrored in cloudflare-workers/utils/analytics.ts so the
// proxy workers emit the same GA4 events. Keep the two in sync; see
// https://github.com/owid/cloudflare-workers/issues/26 for the rationale
// against extracting a shared library.

import * as Sentry from "@sentry/cloudflare"
import { parseCookie } from "cookie"
import { Env } from "./env.js"
import { v7 as uuidv7 } from "uuid"

export async function sendEventToGA4(
    event: { name: string; params: Record<string, string | number> },
    request: Request,
    env: Env
) {
    if (!validateAnalyticsEnvVariables(env)) {
        return
    }
    const cookies = parseCookie(request.headers.get("Cookie") || "")
    const client_id = extractClientIdFromGACookie(cookies["_ga"]) || uuidv7()

    const ga4Endpoint = `https://www.google-analytics.com/mp/collect?api_secret=${env.CLOUDFLARE_GOOGLE_ANALYTICS_MEASUREMENT_PROTOCOL_KEY}&measurement_id=${env.CLOUDFLARE_GOOGLE_ANALYTICS_MEASUREMENT_ID}`

    try {
        const response = await fetch(ga4Endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id,
                events: [event],
            }),
        })

        if (!response.ok) {
            const text = await response.text()
            Sentry.captureException(
                new Error(
                    `GA4 MP request failed with status ${response.status}: ${text}`
                )
            )
        } else {
            console.log("GA4 MP event sent successfully.")
        }
    } catch (error) {
        console.error("Error sending event to GA4 MP:", error)
    }
}

export function getCommonEventParams(
    request: Request,
    env: Pick<Env, "CLOUDFLARE_GOOGLE_ANALYTICS_SAMPLING_RATE">
) {
    const url = new URL(request.url)

    // null values aren't allowed & param values must be 100 characters or less
    const referrer = (request.headers.get("referer") || "").slice(0, 100)
    const fullUserAgent = request.headers.get("user-agent") || ""
    const user_agent = fullUserAgent.slice(0, 100)

    const params: Record<string, string | number> = {
        host: url.hostname,
        pathname: url.pathname,
        referrer,
        user_agent,
        method: request.method,
        country: request.headers.get("cf-ipcountry") || "",
        // Stamp the sampling rate that was active when this event fired, so periods
        // with different rates can be combined correctly downstream
        // (events / sampling ≈ unbiased request count).
        sampling: getSamplingRate(env),
    }

    // If user-agent is longer than 100 chars, capture the next 100 chars
    if (fullUserAgent.length > 100) {
        params.user_agent_next = fullUserAgent.slice(100, 200)
    }

    // Prefix every URL query parameter so user-supplied params can't clobber
    // structured event params such as `host`, `country`, or `status_code`.
    for (const [key, value] of url.searchParams) {
        params[`q_${key}`] = value.slice(0, 100)
    }

    return params
}

function validateAnalyticsEnvVariables(env: Env): boolean {
    return (
        !!env.CLOUDFLARE_GOOGLE_ANALYTICS_MEASUREMENT_PROTOCOL_KEY &&
        !!env.CLOUDFLARE_GOOGLE_ANALYTICS_MEASUREMENT_ID &&
        !!env.CLOUDFLARE_GOOGLE_ANALYTICS_SAMPLING_RATE
    )
}

export const analyticsMiddleware: PagesFunction<Env> = async (context) => {
    const { request, env } = context
    if (!validateAnalyticsEnvVariables(env)) {
        return context.next()
    }
    if (shouldSample(env)) {
        // Get the response first to capture status code
        const response = await context.next()

        const event = {
            name: "cf_function_invocation",
            params: {
                ...getCommonEventParams(request, env),
                status_code: response.status,
            },
        }

        // Use waitUntil to send analytics without blocking the response
        context.waitUntil(sendEventToGA4(event, request, env))

        return response
    }

    return context.next()
}

function shouldSample(env: Env): boolean {
    return Math.random() < getSamplingRate(env)
}

function getSamplingRate(
    env: Pick<Env, "CLOUDFLARE_GOOGLE_ANALYTICS_SAMPLING_RATE">
): number {
    return parseFloat(env.CLOUDFLARE_GOOGLE_ANALYTICS_SAMPLING_RATE)
}

// e.g. GA1.1.156980023.1749503476 -> 156980023.1749503476
function extractClientIdFromGACookie(cookieValue?: string): string | null {
    if (!cookieValue) return null
    const parts = cookieValue.split(".")
    if (parts.length >= 4) return `${parts[2]}.${parts[3]}`
    return cookieValue
}
