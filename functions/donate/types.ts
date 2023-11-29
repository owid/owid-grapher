export enum Interval {
    ONCE = "once",
    MONTHLY = "monthly",
}

export enum CurrencyCode {
    USD = "USD",
    GBP = "GBP",
    EUR = "EUR",
}

export interface DonationRequest {
    name: string
    showOnList: boolean
    currency?: CurrencyCode
    amount: number
    interval: Interval
    successUrl: string
    cancelUrl: string
    captchaToken: string
}

export interface StripeMetadata {
    name: string
    showOnList: boolean
}

const {
    STRIPE_MONTHLY_USD_PLAN_ID,
    STRIPE_MONTHLY_GBP_PLAN_ID,
    STRIPE_MONTHLY_EUR_PLAN_ID,
} = process.env

export const plansByCurrencyCode: Record<CurrencyCode, string> = {
    [CurrencyCode.USD]: STRIPE_MONTHLY_USD_PLAN_ID!,
    [CurrencyCode.GBP]: STRIPE_MONTHLY_GBP_PLAN_ID!,
    [CurrencyCode.EUR]: STRIPE_MONTHLY_EUR_PLAN_ID!,
}
