import { SENTRY_ADMIN_DSN } from "../settings/clientSettings.mjs"
import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"
import { openAIIntegration } from "@sentry/node"

if (!process.env.VITEST) {
    // Ensure to call this before importing any other modules!
    Sentry.init({
        // Deliberately keep Sentry v11's permissive defaults on the backend:
        // besides user info this collects request/response headers and bodies,
        // cookies, query params, DB query text, OpenAI prompts/completions and
        // local variables in stack frames. The SDK redacts keys that look like
        // credentials (auth, session, cookie, token, ...), which covers the
        // admin's `authorization` header and `CF_Authorization` cookie. The
        // browser and Cloudflare SDKs use the restrictive SENTRY_DATA_COLLECTION
        // config instead.
        dataCollection: { userInfo: true },
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
        profileLifecycle: "trace", // use the SDK-managed profiling lifecycle
        // Session sampling is decided once per process startup.
        profileSessionSampleRate: process.env.ENV === "staging" ? 0.25 : 1.0,
        environment: process.env.ENV,
        release: process.env.COMMIT_SHA,
    })
}
