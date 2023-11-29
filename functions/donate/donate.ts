import { DonationRequest } from "./types.js"
import { URLSearchParams } from "url"
import fetch from "node-fetch"
import { createSession } from "./stripe.js"

const { RECAPTCHA_SECRET_KEY } = process.env

const DEFAULT_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
    "Access-Control-Allow-Headers":
        "Content-Type, Access-Control-Allow-Headers, X-Requested-With",
}

export const onRequestPost: PagesFunction = async (context) => {
    // Parse the body of the request as JSON
    const data: DonationRequest = await context.request.json()

    try {
        if (!(await validCaptcha(data.captchaToken))) {
            throw {
                status: 400,
                message:
                    "The CAPTCHA challenge failed, please try submitting the form again.",
            }
        }
        const session = await createSession(data)
        return new Response(JSON.stringify({ id: session.id }), {
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

async function validCaptcha(token: string): Promise<boolean> {
    const body = new URLSearchParams({
        secret: RECAPTCHA_SECRET_KEY,
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
