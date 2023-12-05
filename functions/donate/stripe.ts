import Stripe from "stripe"
import { DonationRequest, Interval, CurrencyCode } from "./types.js"

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

    const metadata: Stripe.Metadata = {
        name,
        // showOnList is not strictly necessary since we could just rely on the
        // presence of a name to indicate the willingness to be shown on the
        // list (a name can only be filled in if showOnList is true). It might
        // however be useful to have the explicit boolean in the Stripe portal
        // for auditing purposes. Note: Stripe metadata are key-value pairs of
        // strings, hence the (voluntarily explicit) conversion.
        showOnList: showOnList.toString(),
    }

    const options: Stripe.Checkout.SessionCreateParams = {
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_method_types: getPaymentMethodTypes(donation),
    }

    const messageInterval =
        interval === Interval.MONTHLY
            ? "You will be charged monthly and can cancel any time by writing us at donate@ourworldindata.org."
            : "You will only be charged once."
    const message = showOnList
        ? `You chose for your donation to be publicly attributed to "${metadata.name}. It will appear on our list of donors next time we update it. The donation amount will not be disclosed. ${messageInterval}`
        : `You chose to remain anonymous, your name won't be shown on our list of donors. ${messageInterval}`

    if (interval === Interval.MONTHLY) {
        options.mode = "subscription"
        options.subscription_data = {
            metadata,
        }
        options.line_items = [
            {
                price_data: {
                    currency: currency,
                    product_data: {
                        name: "Monthly donation",
                    },
                    recurring: {
                        interval: "month",
                        interval_count: 1,
                    },
                    unit_amount: amount,
                },
                quantity: 1,
            },
        ]
        options.custom_text = {
            submit: {
                message,
            },
        }
    } else if (interval === Interval.ONCE) {
        options.mode = "payment"
        // Create a customer for one-time payments. Without this, payments are
        // associated with guest customers, which are not surfaced when exporting
        // donors in owid-donors. Note: this doesn't apply to subscriptions, where
        // customers are always created.
        options.customer_creation = "always"
        options.payment_intent_data = {
            metadata,
        }
        options.custom_text = {
            submit: {
                message,
            },
        }
        options.line_items = [
            {
                price_data: {
                    currency: currency,
                    product_data: {
                        name: "One-time donation",
                    },
                    unit_amount: amount,
                },
                quantity: 1,
            },
        ]
    }

    try {
        return await stripe.checkout.sessions.create(options)
    } catch (error) {
        throw { message: `Error from our payments processor: ${error.message}` }
    }
}
