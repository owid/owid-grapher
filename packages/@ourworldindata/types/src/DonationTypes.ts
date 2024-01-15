import { Static, Type } from "@sinclair/typebox"
export type DonationInterval = "once" | "monthly"

export type DonationCurrencyCode = "USD" | "GBP" | "EUR"

export interface DonateSessionResponse {
    url?: string
    error?: string
}

// This is used to validate the type of the request body in the donate session
// when received by the server (see functions/donation/checkout).
export const DonationRequestTypeObject = Type.Object({
    name: Type.Optional(Type.String()),
    showOnList: Type.Boolean(),
    currency: Type.Union([
        Type.Literal("GBP"),
        Type.Literal("EUR"),
        Type.Literal("USD"),
    ]),
    amount: Type.Optional(
        Type.Number({
            // We don't want to enforce a minimum or maximum donation amount at the
            // type level so that we can return friendlier error messages than
            // Typebox's default ones. These friendlier error messages are returned
            // by getErrorMessageDonation().
        })
    ),
    interval: Type.Union([Type.Literal("once"), Type.Literal("monthly")]),
    successUrl: Type.String(),
    cancelUrl: Type.String(),
    captchaToken: Type.String(),
})

export type DonationRequest = Static<typeof DonationRequestTypeObject>
