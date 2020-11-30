const Stripe = (window as any).Stripe
import { STRIPE_PUBLIC_KEY } from "settings/clientSettings"

const stripe = Stripe ? Stripe(STRIPE_PUBLIC_KEY) : undefined

export default stripe
