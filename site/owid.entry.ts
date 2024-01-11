import "./owid.scss"
import "@ourworldindata/grapher/src/core/grapher.scss"
// From https://fontawesome.com/how-to-use/on-the-web/other-topics/server-side-rendering:
// "If the CSS is missing when this icon displays in the browser it will flash
// from a very large icon down to a properly sized one a moment later."
import "@fortawesome/fontawesome-svg-core/styles.css"

import { runChartsIndexPage } from "./runChartsIndexPage.js"
import { runSearchPage } from "./search/SearchPanel.js"
import { runNotFoundPage } from "./NotFoundPageMain.js"
import { runFeedbackPage } from "./Feedback.js"
import { runDonateForm } from "./DonateForm.js"
import { runCountryProfilePage } from "./runCountryProfilePage.js"
import { runTableOfContents } from "./TableOfContents.js"
import { runRelatedCharts } from "./blocks/RelatedCharts.js"
import { Explorer } from "../explorer/Explorer.js"
import {
    ENV,
    BUGSNAG_API_KEY,
    ADMIN_BASE_URL,
} from "../settings/clientSettings.js"
import { Grapher, CookieKey } from "@ourworldindata/grapher"
import { MultiEmbedderSingleton } from "../site/multiembedder/MultiEmbedder.js"
import { CoreTable } from "@ourworldindata/core-table"
import { SiteAnalytics } from "./SiteAnalytics.js"
import Bugsnag, { BrowserConfig } from "@bugsnag/js"
import BugsnagPluginReact from "@bugsnag/plugin-react"
import { runMonkeyPatchForGoogleTranslate } from "./hacks.js"
import { runSiteFooterScripts } from "./runSiteFooterScripts.js"
import {
    PreferenceType,
    getPreferenceValue,
} from "./CookiePreferencesManager.js"

declare let window: any
window.Grapher = Grapher
window.Explorer = Explorer
window.CoreTable = CoreTable
window.runChartsIndexPage = runChartsIndexPage
window.runSearchPage = runSearchPage
window.runNotFoundPage = runNotFoundPage
window.runFeedbackPage = runFeedbackPage
window.runDonateForm = runDonateForm
window.runCountryProfilePage = runCountryProfilePage
window.runTableOfContents = runTableOfContents
window.runRelatedCharts = runRelatedCharts
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
    } catch (error) {
        console.error("Failed to initialize Bugsnag")
    }
}

const analytics = new SiteAnalytics(ENV)

document.querySelector("html")?.classList.add("js")

try {
    // Cookie access can be restricted by iframe sandboxing, in which case the below code will throw an error
    // see https://github.com/owid/owid-grapher/pull/2452

    if (
        document.cookie.includes("wordpress") ||
        document.cookie.includes("wp-settings") ||
        document.cookie.includes(CookieKey.isAdmin)
    ) {
        const adminbar = document.getElementById("wpadminbar")
        if (adminbar) adminbar.style.display = ""
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
} catch {}

analytics.startClickTracking()
