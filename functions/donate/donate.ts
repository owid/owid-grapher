import fetch from "node-fetch"
import { createCheckoutSession } from "./stripe.js"
import {
    DonateSessionResponse,
    DonationRequest,
    JsonError,
    PLEASE_TRY_AGAIN,
    stringifyUnknownError,
} from "@ourworldindata/utils"

interface EnvVars {
    ASSETS: Fetcher
    STRIPE_SECRET_KEY: string
    RECAPTCHA_SECRET_KEY: string
}

// CORS headers need to be sent in responses to both preflight ("OPTIONS") and
// actual requests.
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // The Content-Type header is required to allow requests to be sent with a
    // Content-Type of "application/json". This is because "application/json" is
    // not an allowed value for Content-Type to be considered a CORS-safelisted
    // header.
    // - https://developer.mozilla.org/en-US/docs/Glossary/CORS-safelisted_request_header
    "Access-Control-Allow-Headers": "Content-Type",
}

const DEFAULT_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" }

const isEnvVars = (env: any): env is EnvVars => {
    return !!env.ASSETS && !!env.STRIPE_SECRET_KEY && !!env.RECAPTCHA_SECRET_KEY
}

// This function is called when the request is a preflight request ("OPTIONS").
export const onRequestOptions: PagesFunction = async () => {
    return new Response(null, {
        headers: CORS_HEADERS,
        status: 200,
    })
}

export const onRequestPost: PagesFunction = async ({
    request,
    env,
}: {
    request: Request
    env
}) => {
    if (!isEnvVars(env))
        // This error is not being caught and surfaced to the client voluntarily.
        throw new Error(
            "Missing environment variables. Please check that both STRIPE_SECRET_KEY and RECAPTCHA_SECRET_KEY are set."
        )

    // Parse the body of the request as JSON
    const data: DonationRequest = await request.json()

    try {
        if (
            !(await isCaptchaValid(data.captchaToken, env.RECAPTCHA_SECRET_KEY))
        )
            throw new JsonError(
                `The CAPTCHA challenge failed. ${PLEASE_TRY_AGAIN}`
            )

        const session = await createCheckoutSession(data, env.STRIPE_SECRET_KEY)
        const sessionResponse: DonateSessionResponse = { url: session.url }

        return new Response(JSON.stringify(sessionResponse), {
            headers: DEFAULT_HEADERS,
            status: 200,
        })
    } catch (error) {
        return new Response(
            JSON.stringify({ error: stringifyUnknownError(error) }),
            {
                headers: CORS_HEADERS,
                status: +error.status || 500,
            }
        )
    }
}

async function isCaptchaValid(token: string, key: string): Promise<boolean> {
    const body = new URLSearchParams({
        secret: key,
        response: token,
    })
    const response = await fetch(
        "https://www.google.com/recaptcha/api/siteverify",
        {
            method: "post",
            body: body,
        }
    )
    const json = (await response.json()) as { success: boolean }
    return json.success
}
