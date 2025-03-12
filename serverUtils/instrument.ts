import { SENTRY_ADMIN_DSN } from "../settings/clientSettings.js"
import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"

if (!process.env.VITEST) {
    // Ensure to call this before importing any other modules!
    Sentry.init({
        dsn: SENTRY_ADMIN_DSN,
        integrations: [nodeProfilingIntegration()],
        tracesSampleRate: 0.1,
        profilesSampleRate: 1.0, // This is relative to tracesSampleRate
        environment: process.env.ENV,
        release: process.env.COMMIT_SHA,
    })
}
