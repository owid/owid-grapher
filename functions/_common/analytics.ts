// This file is mirrored in cloudflare-workers/utils/analytics.ts so the
// proxy workers emit the same GA4 events. Keep the two in sync; see
// https://github.com/owid/cloudflare-workers/issues/26 for the rationale
// against extracting a shared library.

import * as Sentry from "@sentry/cloudflare"
import { parseCookie } from "cookie"
import { GRAPHER_QUERY_PARAM_KEYS } from "@ourworldindata/types"
import { extractClientIdFromGACookie } from "./cookieTools.js"
import { Env } from "./env.js"
import { uuidv7 } from "uuidv7"

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

export function getCommonEventParams(request: Request) {
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
    }

    // If user-agent is longer than 100 chars, capture the next 100 chars
    if (fullUserAgent.length > 100) {
        params.user_agent_next = fullUserAgent.slice(100, 200)
    }

    // Grapher params get namespaced under q_* so a request like `?country=DE`
    // doesn't clobber the structured `country` (sourced from cf-ipcountry).
    // Other query params pass through bare, except for collisions with
    // structured names (host/pathname/etc.) and `status_code` (added by the
    // caller in analyticsMiddleware below).
    const grapherKeys = new Set<string>(GRAPHER_QUERY_PARAM_KEYS)
    const reserved = new Set([...Object.keys(params), "status_code"])
    for (const [key, value] of url.searchParams) {
        if (grapherKeys.has(key)) {
            params[`q_${key}`] = value.slice(0, 100)
        } else if (!reserved.has(key)) {
            params[key] = value.slice(0, 100)
        }
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
                ...getCommonEventParams(request),
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
    return (
        Math.random() <
        parseFloat(env.CLOUDFLARE_GOOGLE_ANALYTICS_SAMPLING_RATE)
    )
}
