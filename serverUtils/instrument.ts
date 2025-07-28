import { SENTRY_ADMIN_DSN } from "../settings/clientSettings.js"
import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"
import { openAIIntegration } from "@sentry/node"

if (!process.env.VITEST) {
    // Ensure to call this before importing any other modules!
    Sentry.init({
        sendDefaultPii: true, // fine to enable in the backend, there's no relevant user data
        dsn: SENTRY_ADMIN_DSN,
        integrations: [
            nodeProfilingIntegration(),

            // traces calls to the OpenAI package.
            // currently, it can only trace `chat.completions.create`, not `chat.completions.parse` - which means that
            // at the time of writing (July 2025), it can only capture the "image alt-text generation" feature, and not
            // "automatic chart tagging".
            openAIIntegration(),
        ],
        tracesSampleRate: 0.1,
        profilesSampleRate: 1.0, // This is relative to tracesSampleRate
        environment: process.env.ENV,
        release: process.env.COMMIT_SHA,
    })
}
