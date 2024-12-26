import Stripe from "stripe"
import { DEFAULT_HEADERS, STRIPE_API_VERSION } from "./_utils/constants.js"
import { JsonError, stringifyUnknownError } from "@ourworldindata/utils"
import { MailgunEnvVars, sendMail } from "./_utils/email.js"
import { SlackEnvVars, logError } from "./_utils/error.js"

interface MessageData {
    email: string
    customerId: string
    name: string
    showOnList: boolean
    isMonthly: boolean
    giftAid: boolean
}

type ThankYouEnvVars = {
    STRIPE_WEBHOOK_SECRET: string
    STRIPE_API_KEY: string
} & MailgunEnvVars &
    SlackEnvVars

const filePath = "donation/thank-you.ts"

const hasThankYouEnvVars = (env: unknown): env is ThankYouEnvVars => {
    return (
        typeof env === "object" &&
        "STRIPE_WEBHOOK_SECRET" in env &&
        "STRIPE_API_KEY" in env &&
        !!env.STRIPE_WEBHOOK_SECRET &&
        !!env.STRIPE_API_KEY
    )
}

const constructMessage = (data: MessageData): string => {
    // This is more readable and makes the plain text formatting easier than a
    // template string.
    return [
        "Thank you for supporting Our World in Data!",
        "Your generous donation to Global Change Data Lab, the nonprofit behind Our World in Data, helps us achieve our mission to make data and research on the world’s biggest challenges easier to understand and use, for everyone: https://ourworldindata.org/problems-and-progress",
        "Together, we can make progress against those challenges.",
        "Donations like yours are essential to our work. They provide us with the stability and independence to expand our work and increase our impact — delivering more data, charts, and insights on an increasing number of pressing topics, all free and open to the world.",
        data.isMonthly &&
            "We really appreciate your ongoing support! You’ll receive a receipt each month after your payment is processed. If you’d like to cancel your recurring donation at any point, just email us at donate@ourworldindata.org and we’ll take care of that for you.",
        data.showOnList &&
            "In recognition of your support, we will be delighted to include your name as part of our List of Supporters: https://ourworldindata.org/funding. We will add your name the next time we update the list, which we do every few months. The amount of your donation will not be disclosed.",
        "Stay connected with our work: Follow us on social media or sign up for one of our newsletters here: https://ourworldindata.org/#subscribe (As a valued donor, we may also share an occasional donor-only update with you, from which you may unsubscribe at any time.)",
        "Are you a UK taxpayer? If so, you can increase the value of your donation to us by 25% — at no extra cost to you — through the UK government’s Gift Aid scheme. Simply enter your name and address and tick a box on this form to confirm your UK taxpayer status, and we’ll take care of the rest:",
        `https://docs.google.com/forms/d/e/1FAIpQLSe7Mgm70-3UiRfh_aEJCusWCabdBFPN7hXoXMnby_6aAJsJVg/viewform?usp=pp_url&entry.2044643286=gcdl_${data.customerId}`,
        "Let us know if you have any questions: donate@ourworldindata.org",
        "Thank you again for supporting us! Your generosity makes our work possible.",
        "Wishing you the best,\nThe Our World in Data Team",
    ]
        .filter(Boolean)
        .join("\n\n")
}

function constructHtmlMessage(data: MessageData): string {
    // The HTML comment is to make prettier format the string as HTML.
    return /* HTML */ `<p>Thank you for supporting Our World in Data!</p>
        <p>
            Your generous donation to Global Change Data Lab, the nonprofit
            behind Our World in Data, helps us achieve
            <a href="https://ourworldindata.org/problems-and-progress"
                >our mission</a
            >
            to make data and research on the world’s biggest challenges easier
            to understand and use, for <em>everyone</em>. Together, we can make
            progress against those challenges.
        </p>
        <p>
            Donations like yours are essential to our work. They provide us with
            the stability and independence to expand our work and increase our
            impact — delivering more data, charts, and insights on an increasing
            number of pressing topics, all free and open to the world.
        </p>
        ${data.isMonthly
            ? `<p>We really appreciate your ongoing support! You’ll receive a receipt each month after your payment is processed. If you’d like to cancel your recurring donation at any point, just email us at <a href="mailto:donate@ourworldindata.org">donate@ourworldindata.org</a> and we'll take care of that for you.</p>`
            : ""}
        ${data.showOnList
            ? `<p>In recognition of your support, we will be delighted to include your name as part of our <a href="https://ourworldindata.org/funding">List of Supporters</a>. We will add your name the next time we update the list, which we do every few months. The amount of your donation will not be disclosed.</p>`
            : ""}
        <p>
            <strong>Stay connected with our work:</strong> Follow us on social
            media or sign up for one of our newsletters here:
            <a href="https://ourworldindata.org/#subscribe"
                >https://ourworldindata.org/#subscribe</a
            >
            (As a valued donor, we may also share an occasional donor-only
            update with you, from which you may unsubscribe at any time.)
        </p>
        <p>
            <strong>Are you a UK taxpayer?</strong> If so, you can increase the
            value of your donation to us by 25% — at no extra cost to you —
            through the UK government’s <strong>Gift Aid</strong> scheme. Simply
            enter your name and address and tick a box on
            <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSe7Mgm70-3UiRfh_aEJCusWCabdBFPN7hXoXMnby_6aAJsJVg/viewform?usp=pp_url&entry.2044643286=gcdl_${data.customerId}"
                >this form</a
            >
            to confirm your UK taxpayer status, and we’ll take care of the rest.
            <a href="mailto:donate@ourworldindata.org">Let us know</a> if you
            have any questions.
        </p>
        <p>
            Thank you again for supporting us! Your generosity makes our work
            possible.
        </p>
        <p>Wishing you the best,<br /><i>The Our World in Data Team</i></p>`
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
            html: constructHtmlMessage(data),
        },
        env
    )
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
        if (!hasThankYouEnvVars(env)) {
            throw new JsonError(
                "Missing environment variables. Please check that both STRIPE_WEBHOOK_SECRET and STRIPE_API_KEY are set.",
                500
            )
        }
        const stripe = new Stripe(env.STRIPE_API_KEY, {
            apiVersion: STRIPE_API_VERSION,
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
            case "checkout.session.completed": {
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
                            (session.amount_total >= 3000 || // 30 GBP
                                // If the donation is monthly, the overall
                                // amount will likely be more than 30 GBP and
                                // thus qualifies for Gift Aid processing by our
                                // definition.
                                session.mode === "subscription"),
                    },
                    env
                )
                break
            }
            default: {
                // do not process other event types
                break
            }
        }

        return new Response(null, {
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

// onRequestOptions shouldn't be necessary here since this webhook is not called from
// the browser, so we don't need to handle preflight requests.
