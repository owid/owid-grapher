import * as Stripe from 'stripe'

import { STRIPE_SECRET_KEY } from 'settings'

const stripe = new Stripe(STRIPE_SECRET_KEY)

