import * as Sentry from "@sentry/react"
import { isInIFrame } from "@ourworldindata/utils"
import {
    COMMIT_SHA,
    ENV,
    LOAD_SENTRY,
    SENTRY_DSN,
} from "../settings/clientSettings.js"
import { getPreferenceValue, PreferenceType } from "./cookiePreferences.js"

// Type definition for gtag function
declare global {
    interface Window {
        gtag?: (
            command: string,
            targetId: string,
            config: string,
            callback: (value: string) => void
        ) => void
    }
}

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
        // Try to get GA client ID and set it as Sentry user ID
        setTimeout(() => {
            try {
                // Check if gtag is available (loaded via GTM)
                if (typeof window !== "undefined" && window.gtag) {
                    // Get client ID from gtag API
                    window.gtag("get", "*", "client_id", (clientId: string) => {
                        if (clientId) {
                            Sentry.setUser({ id: clientId })
                        }
                        console.log(
                            "GA client ID set as Sentry user ID:",
                            clientId
                        )
                    })
                } else if (typeof window !== "undefined") {
                    // Fallback to reading _ga cookie if gtag isn't available
                    const gaCookie = document.cookie
                        .split("; ")
                        .find((row) => row.startsWith("_ga="))
                        ?.split("=")[1]

                    if (gaCookie) {
                        // Extract client ID from GA cookie (format: GA1.1.clientId.timestamp)
                        const parts = gaCookie.split(".")
                        if (parts.length >= 4) {
                            const clientId = `${parts[2]}.${parts[3]}`
                            Sentry.setUser({ id: clientId })
                        }
                    }
                    console.log(
                        "GA client ID set as Sentry user ID from cookie:",
                        gaCookie
                    )
                }
            } catch (error) {
                console.warn(
                    "Failed to set GA client ID as Sentry user:",
                    error
                )
            }
        }, 1000) // Wait 1 second for GTM/analytics to load
    }
}
