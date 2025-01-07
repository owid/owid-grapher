import "@ourworldindata/grapher/src/core/grapher.scss"
import "./owid.scss"
// From https://fontawesome.com/how-to-use/on-the-web/other-topics/server-side-rendering:
// "If the CSS is missing when this icon displays in the browser it will flash
// from a very large icon down to a properly sized one a moment later."
import "@fortawesome/fontawesome-svg-core/styles.css"

import { runSearchPage } from "./search/runSearchPage.js"
import { runNotFoundPage } from "./NotFoundPageMain.js"
import { runFeedbackPage } from "./Feedback.js"
import { runDonateForm } from "./DonateForm.js"
import { runCountryProfilePage } from "./runCountryProfilePage.js"
import { runTableOfContents } from "./runTableOfContents.js"
import { Explorer } from "@ourworldindata/explorer"
import {
    ENV,
    BUGSNAG_API_KEY,
    ADMIN_BASE_URL,
    SENTRY_DSN,
} from "../settings/clientSettings.js"
import { Grapher, CookieKey } from "@ourworldindata/grapher"
import { MultiEmbedderSingleton } from "../site/multiembedder/MultiEmbedder.js"
import { CoreTable } from "@ourworldindata/core-table"
import { isInIFrame } from "@ourworldindata/utils"
import { SiteAnalytics } from "./SiteAnalytics.js"
import Bugsnag, { BrowserConfig } from "@bugsnag/js"
import BugsnagPluginReact from "@bugsnag/plugin-react"
import * as Sentry from "@sentry/react"
import { runMonkeyPatchForGoogleTranslate } from "./hacks.js"
import { runSiteFooterScripts } from "./runSiteFooterScripts.js"
import { PreferenceType, getPreferenceValue } from "./cookiePreferences.js"

declare let window: any
window.Grapher = Grapher
window.Explorer = Explorer
window.CoreTable = CoreTable
window.runSearchPage = runSearchPage
window.runNotFoundPage = runNotFoundPage
window.runFeedbackPage = runFeedbackPage
window.runDonateForm = runDonateForm
window.runCountryProfilePage = runCountryProfilePage
window.runTableOfContents = runTableOfContents
window.MultiEmbedderSingleton = MultiEmbedderSingleton

// Note: do a text search of the project for "runSiteFooterScripts" to find the usage. todo: clean that up.
window.runSiteFooterScripts = runSiteFooterScripts

runMonkeyPatchForGoogleTranslate()

if (BUGSNAG_API_KEY) {
    try {
        const analyticsConsent = getPreferenceValue(PreferenceType.Analytics)

        let bugsnagUserInformation: Pick<
            BrowserConfig,
            "generateAnonymousId" | "user"
        >
        if (analyticsConsent) {
            bugsnagUserInformation = {
                generateAnonymousId: true, // gets saved to localStorage, which we only want if the user has consented to analytics
            }
        } else {
            bugsnagUserInformation = {
                generateAnonymousId: false,
                user: {
                    // generates a random 10-character string
                    // we use it so we can at least identify multiple errors from the same user on a single page, albeit not across pages
                    id: Math.random().toString(36).substring(2, 12),
                },
            }
        }

        Bugsnag.start({
            apiKey: BUGSNAG_API_KEY,
            plugins: [new BugsnagPluginReact()],
            autoTrackSessions: false,
            collectUserIp: false,
            ...bugsnagUserInformation,
        })
    } catch {
        console.error("Failed to initialize Bugsnag")
    }
}

if (SENTRY_DSN) {
    try {
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
            debug: ENV === "development",
            environment: ENV,
            ...sentryOpts,
        })
    } catch {
        console.error("Failed to initialize Sentry")
    }
}

const analytics = new SiteAnalytics(ENV)

document.documentElement?.classList.add("js-loaded")

try {
    // Cookie access can be restricted by iframe sandboxing, in which case the below code will throw an error
    // see https://github.com/owid/owid-grapher/pull/2452

    if (document.cookie.includes(CookieKey.isAdmin)) {
        const gdocAdminBar = document.getElementById("gdoc-admin-bar")
        if (gdocAdminBar) {
            gdocAdminBar.style.display = "initial"
            const id = window._OWID_GDOC_PROPS?.id
            if (id) {
                const gdocLink = `https://docs.google.com/document/d/${id}/edit`
                const adminLink = `${ADMIN_BASE_URL}/admin/gdocs/${id}/preview`
                const admin = gdocAdminBar.querySelector("#admin-link")
                const gdoc = gdocAdminBar.querySelector("#gdoc-link")
                if (admin && gdoc) {
                    admin.setAttribute("href", adminLink)
                    admin.setAttribute("target", "_blank")
                    gdoc.setAttribute("href", gdocLink)
                    gdoc.setAttribute("target", "_blank")
                }
            }
        }
    }
} catch {
    // ignore
}

analytics.startClickTracking()
