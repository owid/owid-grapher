import * as Sentry from "@sentry/cloudflare"
import { extractClientIdFromGACookie, parseCookies } from "./cookieTools.js"
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
    const cookies = parseCookies(request)
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

export function getCommonEventParams(request: Request, pathname: string) {
    const url = new URL(request.url)

    // null values aren't allowed & param values must be 100 characters or less
    const referrer = (request.headers.get("referer") || "").slice(0, 100)
    const user_agent = (request.headers.get("user-agent") || "").slice(0, 100)

    const params = {
        pathname: pathname,
        referrer,
        user_agent,
        method: request.method,
        country: request.headers.get("cf-ipcountry") || "",
    }

    const searchParams = url.searchParams
    for (const [key, value] of searchParams) {
        params[key] = value.slice(0, 100)
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
    const url = new URL(request.url)
    const pathname = url.pathname

    if (shouldSample(env)) {
        // Get the response first to capture status code
        const response = await context.next()

        const event = {
            name: "cf_function_invocation",
            params: {
                ...getCommonEventParams(request, pathname),
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
