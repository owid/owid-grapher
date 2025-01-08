import * as Sentry from "@sentry/react"
import { isInIFrame } from "@ourworldindata/utils"
import { getPreferenceValue, PreferenceType } from "./cookiePreferences.js"

const analyticsConsent = getPreferenceValue(PreferenceType.Analytics)
const environment = process.env.ENV || "development"

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
        replaysSessionSampleRate: environment === "development" ? 1 : 0.1,
        replaysOnErrorSampleRate: 0,
    }
} else {
    sentryOpts = {
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
    }
}
Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment,
    release: process.env.COMMIT_SHA,
    ...sentryOpts,
})
