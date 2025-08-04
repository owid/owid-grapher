import * as Sentry from "@sentry/cloudflare"
import { Env } from "./_common/env.js"
import { analyticsMiddleware } from "./_common/analytics.js"
import { experimentsMiddleware } from "./experiments/middleware.js"

export const onRequest = [
    // Make sure Sentry is the first middleware.
    Sentry.sentryPagesPlugin<Env>((context) => ({
        dsn: context.env.SENTRY_DSN,
        environment: context.env.ENV,
        tracesSampleRate: 0.01,
    })),
    analyticsMiddleware,
    experimentsMiddleware,
]
