import { SENTRY_ADMIN_DSN } from "../settings/clientSettings.mjs"
import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"
import { openAIIntegration } from "@sentry/node"
import { sampleServerTrace } from "./sentryTracing.js"

if (!process.env.VITEST) {
    // Ensure to call this before importing any other modules!
    Sentry.init({
        dataCollection: { userInfo: true }, // fine to enable in the backend, there's no relevant user data
        dsn: SENTRY_ADMIN_DSN,
        integrations: [
            nodeProfilingIntegration(),

            // traces calls to the OpenAI package.
            // currently, it can only trace `chat.completions.create`, not `chat.completions.parse` - which means that
            // at the time of writing (July 2025), it can only capture the "image alt-text generation" feature, and not
            // "automatic chart tagging".
            openAIIntegration(),
        ],
        tracesSampler: sampleServerTrace,
        profileLifecycle: "trace", // profile only while sampled root spans are active
        profileSessionSampleRate: 1.0, // sample every process session, equally in staging and production
        environment: process.env.ENV,
        release: process.env.COMMIT_SHA,
    })
}
