import { z } from "zod/mini"
export type DonationInterval = "once" | "monthly" | "annual"

export type DonationCurrencyCode = "USD" | "GBP" | "EUR"

export interface DonateSessionResponse {
    url?: string
    error?: string
}

// This is used to validate the type of the request body in the donate session
// when received by the server (see functions/donation/checkout).
export const DonationRequestTypeObject = z.object({
    name: z.optional(z.string()),
    showOnList: z.boolean(),
    subscribeToDonorNewsletter: z.boolean(),
    currency: z.union([z.literal("GBP"), z.literal("EUR"), z.literal("USD")]),
    amount: z.optional(
        z.number({
            // We don't want to enforce a minimum or maximum donation amount at the
            // type level so that we can return friendlier error messages than
            // zod's default ones. These friendlier error messages are returned
            // by getErrorMessageDonation().
        })
    ),
    interval: z.union([
        z.literal("once"),
        z.literal("monthly"),
        z.literal("annual"),
    ]),
    successUrl: z.string(),
    cancelUrl: z.string(),
    captchaToken: z.string(),
})

export type DonationRequest = z.infer<typeof DonationRequestTypeObject>
