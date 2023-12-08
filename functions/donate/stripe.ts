import Stripe from "stripe"
import {
    DonationRequest,
    DonationRequestTypeObject,
    getErrorMessageDonation,
    JsonError,
} from "@ourworldindata/utils"
import { Value } from "@sinclair/typebox/value"

function getPaymentMethodTypes(
    donation: DonationRequest
): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] {
    if (donation.interval === "once" && donation.currency === "EUR") {
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

export async function createCheckoutSession(donation: unknown, key: string) {
    const stripe = new Stripe(key, {
        apiVersion: "2023-10-16",
        maxNetworkRetries: 2,
    })

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

    // When the donation object is valid, we check that the donation parameters
    // are within the allowed range. If not, we send a helpful error message.
    // Once again, this step should never fail when the request is coming from
    // the client since we are running the same validation code there before
    // sending it over to the server.
    const errorMessage = getErrorMessageDonation(donation)
    if (errorMessage) throw new JsonError(errorMessage)

    const {
        name,
        amount,
        currency,
        showOnList,
        interval,
        successUrl,
        cancelUrl,
    } = donation

    const amountRoundedCents = Math.floor(amount) * 100

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
        interval === "monthly"
            ? "You will be charged monthly and can cancel any time by writing us at donate@ourworldindata.org."
            : "You will only be charged once."
    const message = showOnList
        ? `You chose for your donation to be publicly attributed to "${metadata.name}. It will appear on our list of donors next time we update it. The donation amount will not be disclosed. ${messageInterval}`
        : `You chose to remain anonymous, your name won't be shown on our list of donors. ${messageInterval}`

    if (interval === "monthly") {
        options.mode = "subscription"
        options.subscription_data = {
            metadata,
        }
        options.line_items = [
            {
                price_data: {
                    currency,
                    product_data: {
                        name: "Monthly donation",
                    },
                    recurring: {
                        interval: "month",
                        interval_count: 1,
                    },
                    unit_amount: amountRoundedCents,
                },
                quantity: 1,
            },
        ]
        options.custom_text = {
            submit: {
                message,
            },
        }
    } else if (interval === "once") {
        options.submit_type = "donate"
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
                    currency,
                    product_data: {
                        name: "One-time donation",
                    },
                    unit_amount: amountRoundedCents,
                },
                quantity: 1,
            },
        ]
    }

    try {
        return await stripe.checkout.sessions.create(options)
    } catch (error) {
        throw new JsonError(
            `Error from our payments processor: ${error.message}`,
            500
        )
    }
}
