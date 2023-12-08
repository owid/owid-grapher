/**
 * This file cointains code shared by the DonateForm component on the client and
 * the donate Cloudflare function on the server.
 */

import { DonationCurrencyCode, DonationRequest } from "./owidTypes"

const CURRENCY_SYMBOLS: Record<DonationCurrencyCode, string> = {
    GBP: "£",
    EUR: "€",
    USD: "$",
}
export const getCurrencySymbol = (currency: DonationCurrencyCode): string => {
    return CURRENCY_SYMBOLS[currency]
}

export const SUPPORTED_CURRENCY_CODES: DonationCurrencyCode[] = [
    "GBP",
    "EUR",
    "USD",
]

export const MIN_DONATION_AMOUNT = 1
export const MAX_DONATION_AMOUNT = 10_000

export const PLEASE_TRY_AGAIN =
    "Please try again. If the problem persists, please get in touch with us at donate@ourworldindata.org."

export const getErrorMessageDonation = (
    donation: DonationRequest
): string | undefined => {
    const symbol = getCurrencySymbol(donation.currency)

    if (!donation.amount)
        return "Please enter an amount or select a preset amount."

    if (
        donation.amount < MIN_DONATION_AMOUNT ||
        donation.amount > MAX_DONATION_AMOUNT
    ) {
        return `You can only donate between ${symbol}${MIN_DONATION_AMOUNT} and ${symbol}${MAX_DONATION_AMOUNT}. For other amounts, please get in touch with us at donate@ourwourldindata.org.`
    }

    if (donation.showOnList && !donation.name) {
        return "Please enter your full name if you would like to be included on our public list of donors."
    }

    return
}
