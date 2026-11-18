import * as Sentry from "@sentry/cloudflare"
import { Env } from "./_common/env.js"
import { analyticsMiddleware } from "./_common/analytics.js"
import { asnDataLayerMiddleware } from "./_common/asnDataLayer.js"
import { experimentsMiddleware } from "./_common/experiments.js"
import { sentryOptions } from "./_common/sentry.js"

export const onRequest = [
    // Make sure Sentry is the first middleware.
    Sentry.sentryPagesPlugin<Env>((context) => sentryOptions(context.env)),
    analyticsMiddleware,
    experimentsMiddleware,
    asnDataLayerMiddleware,
]
