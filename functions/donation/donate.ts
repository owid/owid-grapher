import fetch from "node-fetch"
import { createCheckoutSession } from "./_utils/checkout.js"
import {
    DonateSessionResponse,
    DonationRequestTypeObject,
    JsonError,
    PLEASE_TRY_AGAIN,
    stringifyUnknownError,
} from "@ourworldindata/utils"
import { Value } from "@sinclair/typebox/value"
import { DEFAULT_HEADERS, CORS_HEADERS } from "./_utils/constants.js"
import { SlackEnvVars, logError } from "./_utils/error.js"

type DonateEnvVars = {
    STRIPE_API_KEY: string
    RECAPTCHA_SECRET_KEY: string
} & SlackEnvVars

const filePath = "donation/donate.ts"

const hasDonateEnvVars = (env: any): env is DonateEnvVars => {
    return !!env.STRIPE_API_KEY && !!env.RECAPTCHA_SECRET_KEY
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
    waitUntil,
}: {
    request: Request
    env: unknown
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

        // Check that the received donation object has the right type. Given that we
        // use the same types in the client and the server, this should never fail
        // when the request is coming from the client. However, it could happen if a
        // request is manually crafted. In this case, we select the first error and
        // send TypeBox's default error message.
        if (!Value.Check(DonationRequestTypeObject, donation)) {
            const { message, path } = Value.Errors(
                DonationRequestTypeObject,
                donation
            ).First()
            throw new JsonError(`${message} (${path})`)
        }

        if (
            !(await isCaptchaValid(
                donation.captchaToken,
                env.RECAPTCHA_SECRET_KEY
            ))
        )
            throw new JsonError(
                `The CAPTCHA challenge failed. ${PLEASE_TRY_AGAIN}`
            )

        const session = await createCheckoutSession(
            donation,
            env.STRIPE_API_KEY
        )
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
