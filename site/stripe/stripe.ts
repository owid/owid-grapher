import type { StripeConstructor } from "@stripe/stripe-js"

const Stripe = window.Stripe as StripeConstructor
import { STRIPE_PUBLIC_KEY } from "../../settings/clientSettings.js"

const stripe = Stripe ? Stripe(STRIPE_PUBLIC_KEY) : undefined

export default stripe
