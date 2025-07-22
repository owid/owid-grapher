import * as Sentry from "@sentry/cloudflare"
import { createCheckoutSession } from "./_utils/checkout.js"
import {
    DonateSessionResponse,
    DonationRequestTypeObject,
    JsonError,
    PLEASE_TRY_AGAIN,
    stringifyUnknownError,
} from "@ourworldindata/utils"
import { Env } from "../_common/env.js"
import { DEFAULT_HEADERS, CORS_HEADERS } from "./_utils/constants.js"
import { logError } from "./_utils/error.js"
import { z } from "zod/mini"

const filePath = "donation/donate.ts"

const hasDonateEnvVars = (env: Env) => {
    return !!env.STRIPE_API_KEY && !!env.RECAPTCHA_SECRET_KEY
}

// This function is called when the request is a preflight request ("OPTIONS").
export const onRequestOptions: PagesFunction = async () => {
    return new Response(null, {
        headers: CORS_HEADERS,
        status: 200,
    })
}

export const onRequestPost: PagesFunction<Env> = async ({
    request,
    env,
    waitUntil,
}: {
    request: Request
    env: Env
    waitUntil: (promise: Promise<any>) => void
}) => {
    try {
        if (!hasDonateEnvVars(env))
            throw new JsonError(
                "Missing environment variables. Please check that both STRIPE_API_KEY and RECAPTCHA_SECRET_KEY are set.",
                500
            )
        // Parse the body of the request as JSON
        const donation = await request.json()

        // Load Zod locale so we can use it for error messages.
        // See https://zod.dev/packages/mini?id=no-default-locale
        z.config(z.locales.en())

        // Check that the received donation object has the right type. Given that we
        // use the same types in the client and the server, this should never fail
        // when the request is coming from the client. However, it could happen if a
        // request is manually crafted. In this case, we select the first error and
        // send TypeBox's default error message.
        const { data, error } = DonationRequestTypeObject.safeParse(donation)
        if (!data) {
            const message = z.prettifyError(error)
            throw new JsonError(`Invalid donation request: ${message}`, 400)
        }

        if (
            !(await isCaptchaValid(data.captchaToken, env.RECAPTCHA_SECRET_KEY))
        )
            throw new JsonError(
                `The CAPTCHA challenge failed. ${PLEASE_TRY_AGAIN}`
            )

        const session = await createCheckoutSession(data, env.STRIPE_API_KEY)
        const sessionResponse: DonateSessionResponse = { url: session.url }

        return new Response(JSON.stringify(sessionResponse), {
            headers: DEFAULT_HEADERS,
            status: 200,
        })
    } catch (error) {
        // Using "waitUntil" to make sure the worker doesn't exit before the
        // request to Slack is complete. Not using "await" to avoid delaying
        // sending the response to the client.
        waitUntil(logError(error, filePath, env))
        if (!(error instanceof JsonError) || error.status >= 500) {
            Sentry.captureException(error)
        }
        return new Response(
            JSON.stringify({ error: stringifyUnknownError(error) }),
            {
                headers: DEFAULT_HEADERS,
                status: +error.status || 500,
            }
        )
    }
}

async function isCaptchaValid(token: string, key: string): Promise<boolean> {
    const response = await fetch(
        `https://www.google.com/recaptcha/api/siteverify?secret=${key}&response=${token}`,
        {
            method: "POST",
        }
    )
    const json = (await response.json()) as { success: boolean }
    return json.success
}
