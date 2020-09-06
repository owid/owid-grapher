import "site/client/owid.scss"
import "charts/core/grapher.scss"
// From https://fontawesome.com/how-to-use/on-the-web/other-topics/server-side-rendering:
// "If the CSS is missing when this icon displays in the browser it will flash
// from a very large icon down to a properly sized one a moment later."
import "@fortawesome/fontawesome-svg-core/styles.css"

import SmoothScroll from "smooth-scroll"

import { Analytics } from "charts/core/Analytics"
import { runChartsIndexPage } from "./runChartsIndexPage"
import { runHeaderMenus } from "./SiteHeaderMenus"
import { runSearchPage } from "./SearchPageMain"
import { runNotFoundPage } from "./NotFoundPageMain"
import { runFeedbackPage } from "./Feedback"
import { runDonateForm } from "stripe/DonateForm"
import { getParent } from "./utils"
import { GrapherPageUtils } from "site/client/GrapherPageUtils"
import { GrapherView } from "charts/core/GrapherView"
import { ExploreView } from "explorer/indicatorExplorer/ExploreView"
import { runVariableCountryPage } from "./runVariableCountryPage"
import { runCountryProfilePage } from "./runCountryProfilePage"
import { runCookieNotice } from "./runCookieNotice"
import { runBlocks } from "./blocks"
import { runTableOfContents } from "./TableOfContents"
import { runRelatedCharts } from "./blocks/RelatedCharts/RelatedCharts"
import { runLightbox } from "./Lightbox"
import { runSiteTools } from "./SiteTools"
import { runCovid } from "./covid/index"
import { runGlobalEntityControl } from "site/globalEntityControl/GlobalEntityControl"
import { CovidExplorer } from "explorer/covidExplorer/CovidExplorer"
import { runFootnotes } from "site/client/Footnote"
import { SwitcherExplorer } from "explorer/client/SwitcherExplorer"
import { ENV } from "settings"

declare var window: any
window.GrapherPageUtils = GrapherPageUtils
window.GrapherView = GrapherView
window.CovidExplorer = CovidExplorer
window.SwitcherExplorer = SwitcherExplorer
window.ExploreView = ExploreView
window.runChartsIndexPage = runChartsIndexPage
window.runHeaderMenus = runHeaderMenus
window.runSearchPage = runSearchPage
window.runNotFoundPage = runNotFoundPage
window.runSiteTools = runSiteTools
window.runFeedbackPage = runFeedbackPage
window.runDonateForm = runDonateForm
window.runVariableCountryPage = runVariableCountryPage
window.runCountryProfilePage = runCountryProfilePage
window.runCookieNotice = runCookieNotice
window.runBlocks = runBlocks
window.runTableOfContents = runTableOfContents
window.runRelatedCharts = runRelatedCharts
window.runLightbox = runLightbox
window.runCovid = runCovid
window.runGlobalEntityControl = runGlobalEntityControl
window.runFootnotes = runFootnotes

const analytics = new Analytics(ENV)
analytics.logPageLoad()

document.querySelector("html")?.classList.add("js")

if (
    document.cookie.includes("wordpress") ||
    document.cookie.includes("wp-settings") ||
    document.cookie.includes("isAdmin")
) {
    const adminbar = document.getElementById("wpadminbar")
    if (adminbar) adminbar.style.display = ""
}

new SmoothScroll('a[href*="#"][data-smooth-scroll]', {
    speed: 600,
    durationMax: 800,
    durationMin: 100,
    popstate: false
})

const dataTrackAttr = "data-track-note"

document.addEventListener("click", async ev => {
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
