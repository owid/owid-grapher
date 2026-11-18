import { SENTRY_DATA_COLLECTION } from "@ourworldindata/utils"
import * as Sentry from "@sentry/cloudflare"
import { Env } from "./_common/env.js"
import { analyticsMiddleware } from "./_common/analytics.js"
import { asnDataLayerMiddleware } from "./_common/asnDataLayer.js"
import { experimentsMiddleware } from "./_common/experiments.js"
import { stallDiagMiddleware } from "./_common/stallDiag.js"

export const onRequest = [
    // Outermost, so its timestamps bracket the whole chain.
    stallDiagMiddleware,
    // Make sure Sentry is the first of the real middlewares.
    Sentry.sentryPagesPlugin<Env>((context) => ({
        dataCollection: SENTRY_DATA_COLLECTION,
        dsn: context.env.SENTRY_DSN,
        environment: context.env.ENV,
        tracesSampleRate: 0.01,
    })),
    analyticsMiddleware,
    experimentsMiddleware,
    asnDataLayerMiddleware,
]
