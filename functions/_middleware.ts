import * as Sentry from "@sentry/cloudflare"
import { Env } from "./_common/env.js"
import { analyticsMiddleware } from "./_common/analytics.js"
import { asnDataLayerMiddleware } from "./_common/asnDataLayer.js"
import { experimentsMiddleware } from "./_common/experiments.js"
import { isolateDiagMiddleware } from "./_common/isolateDiag.js"
import { sentryOptions } from "./_common/sentry.js"

export const onRequest = [
    // Outermost, so it counts every request this isolate serves.
    isolateDiagMiddleware,
    // Make sure Sentry is the first of the remaining middlewares.
    Sentry.sentryPagesPlugin<Env>((context) => sentryOptions(context.env)),
    analyticsMiddleware,
    experimentsMiddleware,
    asnDataLayerMiddleware,
]
