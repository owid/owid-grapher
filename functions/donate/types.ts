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

export interface EnvVars {
    ASSETS: Fetcher
    STRIPE_SECRET_KEY: string
    RECAPTCHA_SECRET_KEY: string
}
