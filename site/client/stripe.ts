const Stripe = (window as any).Stripe
import { STRIPE_PUBLIC_KEY } from 'settings'

export default Stripe(STRIPE_PUBLIC_KEY, { betas: ['checkout_beta_4'] })