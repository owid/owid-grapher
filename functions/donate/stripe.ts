import Stripe from "stripe"
import {
    DonationRequest,
    Interval,
    CurrencyCode,
    StripeMetadata,
    plansByCurrencyCode,
} from "./types.js"

const { STRIPE_SECRET_KEY } = process.env

if (!STRIPE_SECRET_KEY) {
    throw new Error("Please set the STRIPE_SECRET_KEY environment variable")
}

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2020-08-27",
    maxNetworkRetries: 2,
})

function getPaymentMethodTypes(
    donation: DonationRequest
): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] {
    if (
        donation.interval === Interval.ONCE &&
        donation.currency === CurrencyCode.EUR
    ) {
        return [
            "card",
            "sepa_debit",
            "giropay",
            "ideal",
            "bancontact",
            "eps",
            "sofort",
        ]
    }
    return ["card"]
}

export async function createSession(donation: DonationRequest, key: string) {
    const stripe = new Stripe(key, {
        apiVersion: "2023-10-16",
        maxNetworkRetries: 2,
    })

    if (donation.amount == null)
        throw { status: 400, message: "Please specify an amount" }
    if (!Object.values(Interval).includes(donation.interval))
        throw { status: 400, message: "Please specify an interval" }
    // Temporarily disable while the new form is being deployed.
    // if (!Object.values(CurrencyCode).includes(donation.currency)) throw { status: 400, message: "Please specify a currency" }
    if (donation.successUrl == null || donation.cancelUrl == null)
        throw {
            status: 400,
            message: "Please specify a successUrl and cancelUrl",
        }

    const { name, showOnList, interval, successUrl, cancelUrl } = donation
    const amount = Math.floor(donation.amount)

    // It used to be only possible to donate in USD, so USD was hardcoded here.
    // We want to temporarily handle the old payload while the new form is deployed.
    const currency = donation.currency || CurrencyCode.USD

    if (amount < 100 || amount > 10_000 * 100) {
        throw {
            status: 400,
            message:
                "You can only donate between $1 and $10,000 USD. For higher amounts, please contact donate@ourworldindata.org",
        }
    }

    const metadata: StripeMetadata = { name, showOnList }

    const options: Stripe.Checkout.SessionCreateParams = {
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_method_types: getPaymentMethodTypes(donation),
    }

    if (interval === Interval.MONTHLY) {
        options.subscription_data = {
            items: [
                {
                    plan: plansByCurrencyCode[currency],
                    quantity: amount,
                },
            ],
            metadata: metadata as any,
        }
    } else if (interval === Interval.ONCE) {
        options.line_items = [
            {
                amount: amount,
                currency: currency,
                name: "One-time donation",
                quantity: 1,
            },
        ]
        options.payment_intent_data = {
            metadata: metadata as any,
        }
    }

    try {
        return await stripe.checkout.sessions.create(options)
    } catch (error) {
        throw { message: `Error from our payments processor: ${error.message}` }
    }
}
