import * as Sentry from "@sentry/react"
import { isInIFrame } from "@ourworldindata/utils"
import { COMMIT_SHA, ENV, SENTRY_DSN } from "../settings/clientSettings.js"
import { getPreferenceValue, PreferenceType } from "./cookiePreferences.js"

const analyticsConsent = getPreferenceValue(PreferenceType.Analytics)

let sentryOpts: Sentry.BrowserOptions
if (analyticsConsent && !isInIFrame()) {
    // only collect session replays from: users that have consented to analytics
    // AND where page isn't embedded in an iframe
    sentryOpts = {
        integrations: [
            Sentry.replayIntegration({
                maskAllText: false,
                maskAllInputs: false,
                blockAllMedia: false,
                mask: [".sentry-mask"],
            }),
        ],
        replaysSessionSampleRate: ENV === "development" ? 1 : 0.1,
        replaysOnErrorSampleRate: 0,
    }
} else {
    sentryOpts = {
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
    }
}
Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENV,
    release: COMMIT_SHA,
    ...sentryOpts,
})
