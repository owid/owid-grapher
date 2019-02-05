const Stripe = (window as any).Stripe
import { STRIPE_PUBLIC_KEY } from 'settings'

const stripe = Stripe ? Stripe(STRIPE_PUBLIC_KEY, { betas: ['checkout_beta_4'] }) : undefined

export default stripe