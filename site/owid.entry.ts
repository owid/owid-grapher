import "./owid.scss"
import "@ourworldindata/grapher/src/core/grapher.scss"
// From https://fontawesome.com/how-to-use/on-the-web/other-topics/server-side-rendering:
// "If the CSS is missing when this icon displays in the browser it will flash
// from a very large icon down to a properly sized one a moment later."
import "@fortawesome/fontawesome-svg-core/styles.css"

import SmoothScroll from "smooth-scroll"
import { runChartsIndexPage } from "./runChartsIndexPage.js"
import { runSearchPage } from "./SearchPageMain.js"
import { runNotFoundPage } from "./NotFoundPageMain.js"
import { runFeedbackPage } from "./Feedback.js"
import { runDonateForm } from "./stripe/DonateForm.js"
import { runCountryProfilePage } from "./runCountryProfilePage.js"
import { runTableOfContents } from "./TableOfContents.js"
import { runRelatedCharts } from "./blocks/RelatedCharts.js"
import { Explorer } from "../explorer/Explorer.js"
import { ENV, BUGSNAG_API_KEY } from "../settings/clientSettings.js"
import { Grapher, CookieKey } from "@ourworldindata/grapher"
import { MultiEmbedderSingleton } from "../site/multiembedder/MultiEmbedder.js"
import { CoreTable } from "@ourworldindata/core-table"
import { SiteAnalytics } from "./SiteAnalytics.js"
import Bugsnag from "@bugsnag/js"
import BugsnagPluginReact from "@bugsnag/plugin-react"
import { runMonkeyPatchForGoogleTranslate } from "./hacks.js"
import { runSiteFooterScripts } from "./runSiteFooterScripts.js"

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
        Bugsnag.start({
            apiKey: BUGSNAG_API_KEY,
            plugins: [new BugsnagPluginReact()],
        })
    } catch (error) {
        console.error("Failed to initialize Bugsnag")
    }
}

const analytics = new SiteAnalytics(ENV)
analytics.logPageLoad()

document.querySelector("html")?.classList.add("js")

if (
    document.cookie.includes("wordpress") ||
    document.cookie.includes("wp-settings") ||
    document.cookie.includes(CookieKey.isAdmin)
) {
    const adminbar = document.getElementById("wpadminbar")
    if (adminbar) adminbar.style.display = ""
}

new SmoothScroll('a[href*="#"][data-smooth-scroll]', {
    speed: 600,
    durationMax: 800,
    durationMin: 100,
    popstate: false,
})

analytics.startClickTracking()
