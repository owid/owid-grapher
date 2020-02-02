// From https://fontawesome.com/how-to-use/on-the-web/other-topics/server-side-rendering:
// "If the CSS is missing when this icon displays in the browser it will flash
// from a very large icon down to a properly sized one a moment later."
import "@fortawesome/fontawesome-svg-core/styles.css"
import "charts/client/chart.scss"
import "site/client/owid.scss"
import "./oldScripts.js"

const SmoothScroll = require("smooth-scroll")

import { ChartView } from "charts/ChartView"
import { ExploreView } from "charts/ExploreView"
import { Grapher } from "site/client/Grapher"
import { Analytics } from "./Analytics"
import { runBlocks } from "./blocks"
import { runDonateForm } from "./DonateForm"
import { runFeedback, runFeedbackPage } from "./Feedback"
import { runNotFoundPage } from "./NotFoundPageMain"
import { runChartsIndexPage } from "./runChartsIndexPage"
import { runCookieNotice } from "./runCookieNotice"
import { runCountryProfilePage } from "./runCountryProfilePage"
import { runVariableCountryPage } from "./runVariableCountryPage"
import { runSearchPage } from "./SearchPageMain"
import { runHeaderMenus } from "./SiteHeaderMenus"
import { runTableOfContents } from "./TableOfContents"
import { getParent } from "./utils"

declare var window: any
window.Grapher = Grapher
window.ChartView = ChartView
window.ExploreView = ExploreView
window.App = window.App || {}
window.runChartsIndexPage = runChartsIndexPage
window.runHeaderMenus = runHeaderMenus
window.runSearchPage = runSearchPage
window.runNotFoundPage = runNotFoundPage
window.runFeedback = runFeedback
window.runFeedbackPage = runFeedbackPage
window.runDonateForm = runDonateForm
window.runVariableCountryPage = runVariableCountryPage
window.runCountryProfilePage = runCountryProfilePage
window.runCookieNotice = runCookieNotice
window.runBlocks = runBlocks
window.runTableOfContents = runTableOfContents

Analytics.logEvent("OWID_PAGE_LOAD")

// tslint:disable-next-line:no-unused-expression
new SmoothScroll('a[href*="#"][data-smooth-scroll]', {
    speed: 600,
    durationMax: 800,
    durationMin: 100,
    popstate: false
})

const search = document.querySelector("form#search-nav") as HTMLFormElement
if (search) {
    const input = search.querySelector("input[type=search]") as HTMLInputElement
    search.addEventListener("submit", ev => {
        ev.preventDefault()
        Analytics.logEvent("OWID_SITE_SEARCH", { query: input.value })
            .then(() => search.submit())
            .catch(() => search.submit())
    })
}

const trackedLinkExists: boolean = !!document.querySelector(
    "[data-track-click]"
)

function createFunctionWithTimeout(callback: () => void, timeout: number = 50) {
    let called = false
    function fn() {
        if (!called) {
            called = true
            callback()
        }
    }
    setTimeout(fn, timeout)
    return fn
}

if (trackedLinkExists) {
    document.addEventListener("click", async ev => {
        const targetElement = ev.target as HTMLElement
        const trackedElement = getParent(
            targetElement,
            (el: HTMLElement) => el.getAttribute("data-track-click") != null
        )
        if (trackedElement) {
            // Note that browsers will cancel all pending requests once a user
            // navigates away from a page. An earlier implementation had a
            // timeout to send the event before navigating, but it broke
            // CMD+CLICK for opening a new tab.
            Analytics.logEvent("OWID_SITE_CLICK", {
                text: trackedElement.innerText,
                href: trackedElement.getAttribute("href"),
                note: trackedElement.getAttribute("data-track-note")
            })
        }
    })
}
