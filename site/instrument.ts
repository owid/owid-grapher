import * as Sentry from "@sentry/react"
import { isInIFrame, retryPromise } from "@ourworldindata/utils"
import Cookies from "js-cookie"
import {
    COMMIT_SHA,
    ENV,
    LOAD_SENTRY,
    SENTRY_DSN,
} from "../settings/clientSettings.js"
import { getPreferenceValue, PreferenceType } from "./cookiePreferences.js"

if (LOAD_SENTRY) {
    const analyticsConsent = getPreferenceValue(PreferenceType.Analytics)

    let sentryOpts: Sentry.BrowserOptions = {}
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
    }
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: ENV,
        release: COMMIT_SHA,
        ...sentryOpts,
    })

    // Set Google Analytics client ID as Sentry user ID for session replays
    if (analyticsConsent && !isInIFrame()) {
        // Use retryPromise to poll for GA cookie with exponential backoff
        // This will keep trying for ~17 minutes total, covering cases where
        // users accept cookies later in their session
        retryPromise(
            () => {
                return new Promise<string>((resolve, reject) => {
                    const gaCookie = Cookies.get("_ga")
                    if (!gaCookie) {
                        reject(new Error("GA cookie not found yet"))
                        return
                    }

                    // Extract client ID from GA cookie (format: GA1.1.clientId.timestamp)
                    const parts = gaCookie.split(".")
                    if (parts.length >= 4) {
                        const clientId = `${parts[2]}.${parts[3]}`
                        Sentry.setUser({ id: clientId })
                        resolve(clientId)
                    } else {
                        reject(new Error("Invalid GA cookie format"))
                    }
                })
            },
            {
                maxRetries: 10,
                exponentialBackoff: true,
                initialDelay: 1000,
            }
        ).catch((error) => {
            console.warn("Failed to set GA client ID as Sentry user:", error)
        })
    }
}
