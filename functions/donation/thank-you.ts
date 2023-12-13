import Stripe from "stripe"
import { DEFAULT_HEADERS } from "./donate.js"

interface EmailOptions {
    email: string
    customerId: string
    name: string
    showOnList: boolean
    isMonthly: boolean
    giftAid: boolean
}

interface ThankYouEnvVars {
    ASSETS: Fetcher
    STRIPE_WEBHOOK_SECRET: string
}

const hasThankYouEnvVars = (env: any): env is ThankYouEnvVars => {
    return !!env.ASSETS && !!env.STRIPE_WEBHOOK_SECRET
}

const constructMessage = (options: EmailOptions): string => {
    return [
        `Dear ${options.name ? options.name : "Sir/Madam"},`,
        "Thank you for your donation to support Global Change Data Lab – the non-profit organization that helps produce the website Our World in Data.",
        options.isMonthly &&
            "You will receive monthly receipts of your payment. If you wish to cancel your recurring donation at any point, just email us at donate@ourworldindata.org.",
        options.giftAid &&
            `If you are a UK tax payer, we can make your donations go further with Gift Aid. Through the Government’s Gift Aid scheme, we can claim an additional 25p for every £1 you donated. So if you are a UK taxpayer, you can increase the value of your donations to us by 25%, at no extra cost to yourself. Simply fill in your details in this form to confirm your taxpayer status: https://docs.google.com/forms/d/e/1FAIpQLSe7Mgm70-3UiRfh_aEJCusWCabdBFPN7hXoXMnby_6aAJsJVg/viewform?usp=pp_url&entry.2044643286=gcdl_${options.customerId}`,
        "Your generosity offers vital support in expanding our efforts to build an independent and free online publication on global development. Your donation will support the expansion of the online publication in close collaboration with our research colleagues at the University of Oxford and around the world.",
        "Given your interest in our work, we hope you will continue to follow our progress via our newsletter – if you have not done so, we’d like to invite you to join: https://ourworldindata.org/subscribe.",
        `Reader donations are essential to our work, providing us with the stability and independence we need, so we can focus on research and the development of our site. ${
            options.showOnList
                ? "In recognition of your support we will be delighted to include your name as part of our List of Supporters: https://ourworldindata.org/supporters. We will add your name the next time we update the list and the sum of your donation will not be disclosed."
                : ""
        }`,
        "Thank you again for your support for Our World in Data, we look forward to taking the project to the next level and we hope that you will remain interested in our work.",
        "Kind regards,\nThe Our World in Data Team",
    ]
        .filter(Boolean)
        .join("\n\n")
}

async function sendThankYouEmail(options: EmailOptions): Promise<void> {
    try {
        // TODO
        console.log(constructMessage(options))
    } catch (error) {
        console.error(error)
    }
}

export const onRequestPost: PagesFunction = async ({
    request,
    env,
}: {
    request: Request
    env
}) => {
    if (!hasThankYouEnvVars(env))
        // This error is not being caught and surfaced to the client voluntarily.
        throw new Error(
            "Missing environment variables. Please check that STRIPE_WEBHOOK_SECRET is set."
        )

    let event: Stripe.Event
    try {
        // Stripe requires the raw body to construct the event
        const requestBodyRaw = await request.text()

        // Construct the event from the signed request payload
        event = await Stripe.webhooks.constructEventAsync(
            requestBodyRaw,
            request.headers.get("stripe-signature"),
            env.STRIPE_WEBHOOK_SECRET
        )
    } catch (err) {
        console.error(err)
        return new Response(`Webhook Error: ${err.message}`, {
            headers: DEFAULT_HEADERS,
            status: 400,
        })
    }

    switch (event.type) {
        case "checkout.session.completed":
            const session = event.data.object
            await sendThankYouEmail({
                email: session.customer_details.email,
                customerId: session.customer as string,
                // We support two checkout modes: "payment" (for one-time payments) and "subscription"
                // These are set when creating the checkout session, in checkout.ts
                // see https://stripe.com/docs/api/checkout/sessions/object#checkout_session_object-mode
                isMonthly: session.mode === "subscription",
                name: session.metadata.name,
                showOnList: session.metadata.showOnList === "true",
                giftAid:
                    (session.customer_details.address.country === "GB" ||
                        session.currency === "gbp") &&
                    session.amount_total >= 3000, // 30 GBP
            })
            break
        default: // do not process other event types
    }

    return new Response(null, {
        headers: DEFAULT_HEADERS,
        status: 200,
    })
}

// onRequestOptions shouldn't be necessary here since this webhook is not called from
// the browser, so we don't need to handle preflight requests.
