/** Initializes Sentry for error tracking and session replay
 *
 * Configures Sentry with the appropriate settings and either samples a session
 * to be recorded (if consent provided) or starts the recording if sampling has
 * already been conducted this session.
 */

import * as Sentry from "@sentry/react"
import {
    COMMIT_SHA,
    ENV,
    SENTRY_DSN,
    LOAD_SENTRY,
} from "../settings/clientSettings.js"
import {
    getSessionSampleRate,
    hasSessionBeenSampled,
    maybeSampleSession,
    updateSentryUser,
    updateSentryExperimentTags,
} from "./SentryUtils.js"

if (LOAD_SENTRY) {
    const sampleRate = getSessionSampleRate()

    // note: if hasSessionBeenSampled() is false, then Sentry.init(...) will do
    // the initial sampling (if consent provided). If hasSessionBeenSampled() is
    // true, we want to give this session a chance to be re-sampled before Sentry
    // initialization, using the logic in maybeSampleSession.
    if (hasSessionBeenSampled()) {
        maybeSampleSession(sampleRate)
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: ENV,
        debug: ENV === "development",
        release: COMMIT_SHA,
        integrations: [
            Sentry.replayIntegration({
                maskAllText: false,
                maskAllInputs: false,
                blockAllMedia: false,
                mask: [".sentry-mask"],
            }),
        ],
        replaysSessionSampleRate: sampleRate,
        replaysOnErrorSampleRate: 0,
    })
    updateSentryTags()
    updateSentryUser()
}

function updateSentryTags() {
    updateSentryReferrerTag()
    updateSentryExperimentTags()
}

function updateSentryReferrerTag() {
    const ref = document.referrer ? new URL(document.referrer).hostname : "none"
    Sentry.setTag("referrer", ref)
}
