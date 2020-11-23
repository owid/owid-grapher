import "site/client/owid.scss"
import "grapher/core/grapher.scss"
// From https://fontawesome.com/how-to-use/on-the-web/other-topics/server-side-rendering:
// "If the CSS is missing when this icon displays in the browser it will flash
// from a very large icon down to a properly sized one a moment later."
import "@fortawesome/fontawesome-svg-core/styles.css"

import SmoothScroll from "smooth-scroll"
import { Analytics } from "grapher/core/Analytics"
import { runChartsIndexPage } from "./runChartsIndexPage"
import { runHeaderMenus } from "./SiteHeaderMenus"
import { runSearchPage } from "./SearchPageMain"
import { runNotFoundPage } from "./NotFoundPageMain"
import { runFeedbackPage } from "./Feedback"
import { runDonateForm } from "stripe/DonateForm"
import { getParent } from "./utils"
import { runVariableCountryPage } from "./runVariableCountryPage"
import { runCountryProfilePage } from "./runCountryProfilePage"
import { runCookiePreferencesManager } from "./CookiePreferencesManager/CookiePreferencesManager"
import { runBlocks } from "./blocks"
import { runTableOfContents } from "./TableOfContents"
import { runRelatedCharts } from "./blocks/RelatedCharts/RelatedCharts"
import { runLightbox } from "./Lightbox"
import { runSiteTools } from "./SiteTools"
import { runCovid } from "./covid/index"
import { hydrateGlobalEntityControlIfAny } from "grapher/controls/globalEntityControl/GlobalEntityControl"
import { runFootnotes } from "site/client/Footnote"
import { Explorer } from "explorer/client/Explorer"
import { ENV } from "settings"
import { CookieKey } from "grapher/core/GrapherConstants"
import { Grapher } from "grapher/core/Grapher"
import { MultiEmbedderSingleton } from "./figures/MultiEmbedder"
import { CoreTable } from "coreTable/CoreTable"

declare var window: any
window.Grapher = Grapher
window.Explorer = Explorer
window.CoreTable = CoreTable
window.runChartsIndexPage = runChartsIndexPage
window.runSearchPage = runSearchPage
window.runNotFoundPage = runNotFoundPage
window.runFeedbackPage = runFeedbackPage
window.runDonateForm = runDonateForm
window.runVariableCountryPage = runVariableCountryPage
window.runCountryProfilePage = runCountryProfilePage
window.runTableOfContents = runTableOfContents
window.runRelatedCharts = runRelatedCharts
window.MultiEmbedderSingleton = MultiEmbedderSingleton

// Note: do a text search of the project for "runSiteFooterScripts" to find the usage. todo: clean that up.
window.runSiteFooterScripts = () => {
    runHeaderMenus()
    runBlocks()
    runLightbox()
    runSiteTools()
    runCookiePreferencesManager()
    runCovid()
    runFootnotes()
    if (!document.querySelector(".ChartPage")) {
        MultiEmbedderSingleton.embedAll()
        hydrateGlobalEntityControlIfAny()
    }
}

const analytics = new Analytics(ENV)
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

const dataTrackAttr = "data-track-note"

document.addEventListener("click", async (ev) => {
    const targetElement = ev.target as HTMLElement
    const trackedElement = getParent(
        targetElement,
        (el: HTMLElement) => el.getAttribute(dataTrackAttr) !== null
    )
    if (trackedElement) {
        // Note that browsers will cancel all pending requests once a user
        // navigates away from a page. An earlier implementation had a
        // timeout to send the event before navigating, but it broke
        // CMD+CLICK for opening a new tab.
        analytics.logSiteClick(
            trackedElement.innerText,
            trackedElement.getAttribute("href") || undefined,
            trackedElement.getAttribute(dataTrackAttr) || undefined
        )
    }
})
