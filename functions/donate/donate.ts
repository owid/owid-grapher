import { DonationRequest, EnvVars } from "./types.js"
import fetch from "node-fetch"
import { createSession } from "./stripe.js"

const DEFAULT_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
    "Access-Control-Allow-Headers":
        "Content-Type, Access-Control-Allow-Headers, X-Requested-With",
}

const isEnvVars = (env: any): env is EnvVars => {
    return !!env.ASSETS && !!env.STRIPE_SECRET_KEY && !!env.RECAPTCHA_SECRET_KEY
}

export const onRequestPost: PagesFunction = async ({
    request,
    env,
}: {
    request: Request
    env
}) => {
    if (!isEnvVars(env))
        throw new Error(
            "Missing environment variables. Please check that both STRIPE_SECRET_KEY and RECAPTCHA_SECRET_KEY are set."
        )

    // Parse the body of the request as JSON
    const data: DonationRequest = await request.json()

    try {
        if (
            !(await validCaptcha(data.captchaToken, env.RECAPTCHA_SECRET_KEY))
        ) {
            throw {
                status: 400,
                message:
                    "The CAPTCHA challenge failed, please try submitting the form again.",
            }
        }
        const session = await createSession(data, env.STRIPE_SECRET_KEY)
        return new Response(JSON.stringify({ url: session.url }), {
            headers: DEFAULT_HEADERS,
            status: 200,
        })
    } catch (error) {
        console.error(error)
        return new Response(
            JSON.stringify({
                message:
                    "An unexpected error occurred. " + (error && error.message),
            }),
            {
                headers: DEFAULT_HEADERS,
                status: +error.status || 500,
            }
        )
    }
}

async function validCaptcha(token: string, key: string): Promise<boolean> {
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
