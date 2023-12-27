import Stripe from "stripe"
import { DEFAULT_HEADERS } from "./donate.js"
import { JsonError, stringifyUnknownError } from "@ourworldindata/utils"
import { MailgunEnvVars, sendMail } from "./_utils/email.js"

interface MessageData {
    email: string
    customerId: string
    name: string
    showOnList: boolean
    isMonthly: boolean
    giftAid: boolean
}

type ThankYouEnvVars = {
    ASSETS: Fetcher
    STRIPE_WEBHOOK_SECRET: string
    STRIPE_SECRET_KEY: string
} & MailgunEnvVars

const hasThankYouEnvVars = (env: unknown): env is ThankYouEnvVars => {
    return (
        typeof env === "object" &&
        "ASSETS" in env &&
        "STRIPE_WEBHOOK_SECRET" in env &&
        "STRIPE_SECRET_KEY" in env &&
        !!env.ASSETS &&
        !!env.STRIPE_WEBHOOK_SECRET &&
        !!env.STRIPE_SECRET_KEY
    )
}

const constructMessage = (data: MessageData): string => {
    return [
        `Dear ${data.name ? data.name : "Sir/Madam"},`,
        "Thank you for your donation to support Global Change Data Lab – the non-profit organization that helps produce the website Our World in Data.",
        data.isMonthly &&
            "You will receive monthly receipts of your payment. If you wish to cancel your recurring donation at any point, just email us at donate@ourworldindata.org.",
        data.giftAid &&
            `If you are a UK tax payer, we can make your donations go further with Gift Aid. Through the Government’s Gift Aid scheme, we can claim an additional 25p for every £1 you donated. So if you are a UK taxpayer, you can increase the value of your donations to us by 25%, at no extra cost to yourself. Simply fill in your details in this form to confirm your taxpayer status: https://docs.google.com/forms/d/e/1FAIpQLSe7Mgm70-3UiRfh_aEJCusWCabdBFPN7hXoXMnby_6aAJsJVg/viewform?usp=pp_url&entry.2044643286=gcdl_${data.customerId}`,
        "Your generosity offers vital support in expanding our efforts to build an independent and free online publication on global development. Your donation will support the expansion of the online publication in close collaboration with our research colleagues at the University of Oxford and around the world.",
        "Given your interest in our work, we hope you will continue to follow our progress via our newsletter – if you have not done so, we’d like to invite you to join: https://ourworldindata.org/subscribe.",
        `Reader donations are essential to our work, providing us with the stability and independence we need, so we can focus on research and the development of our site. ${
            data.showOnList
                ? "In recognition of your support we will be delighted to include your name as part of our List of Supporters: https://ourworldindata.org/supporters. We will add your name the next time we update the list and the sum of your donation will not be disclosed."
                : ""
        }`,
        "Thank you again for your support for Our World in Data, we look forward to taking the project to the next level and we hope that you will remain interested in our work.",
        "Kind regards,\nThe Our World in Data Team",
    ]
        .filter(Boolean)
        .join("\n\n")
}

async function sendThankYouEmail(
    data: MessageData,
    env: ThankYouEnvVars
): Promise<void> {
    await sendMail(
        {
            from: `Our World in Data <donate@ourworldindata.org>`,
            to: data.name ? `${data.name} <${data.email}>` : data.email,
            bcc: "donate@ourworldindata.org",
            subject: "Thank you",
            text: constructMessage(data),
        },
        env
    )
}

export const onRequestPost: PagesFunction = async ({
    request,
    env,
}: {
    request: Request
    env: unknown
}) => {
    try {
        if (!hasThankYouEnvVars(env))
            throw new JsonError(
                "Missing environment variables. Please check that both STRIPE_WEBHOOK_SECRET and STRIPE_SECRET_KEY are set.",
                500
            )

        const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
            apiVersion: "2023-10-16",
            maxNetworkRetries: 2,
        })

        // Stripe requires the raw body to construct the event
        const requestBodyRaw = await request.text()

        // Construct the event from the signed request payload
        const event = await stripe.webhooks.constructEventAsync(
            requestBodyRaw,
            request.headers.get("stripe-signature"),
            env.STRIPE_WEBHOOK_SECRET
        )

        switch (event.type) {
            case "checkout.session.completed":
                const session = event.data.object
                await sendThankYouEmail(
                    {
                        email: session.customer_details.email,
                        customerId: session.customer as string,
                        // We support two checkout modes: "payment" (for one-time payments) and "subscription"
                        // These are set when creating the checkout session, in checkout.ts
                        // see https://stripe.com/docs/api/checkout/sessions/object#checkout_session_object-mode
                        isMonthly: session.mode === "subscription",
                        name: session.metadata.name,
                        showOnList: session.metadata.showOnList === "true",
                        giftAid:
                            (session.customer_details.address.country ===
                                "GB" ||
                                session.currency === "gbp") &&
                            session.amount_total >= 3000, // 30 GBP
                    },
                    env
                )
                break
            default: // do not process other event types
        }

        return new Response(null, {
            headers: DEFAULT_HEADERS,
            status: 200,
        })
    } catch (error) {
        console.error(error)
        return new Response(
            JSON.stringify({ error: stringifyUnknownError(error) }),
            {
                headers: DEFAULT_HEADERS,
                status: +error.status || 500,
            }
        )
    }
}

// onRequestOptions shouldn't be necessary here since this webhook is not called from
// the browser, so we don't need to handle preflight requests.
