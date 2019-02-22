import 'site/client/owid.scss'
import 'charts/client/chart.scss'
import './oldScripts.js'
// From https://fontawesome.com/how-to-use/on-the-web/other-topics/server-side-rendering:
// "If the CSS is missing when this icon displays in the browser it will flash
// from a very large icon down to a properly sized one a moment later."
import '@fortawesome/fontawesome-svg-core/styles.css'

const SmoothScroll = require('smooth-scroll')

import {Analytics} from './Analytics'
import {runChartsIndexPage} from './runChartsIndexPage'
import {runHeaderMenus} from './SiteHeaderMenus'
import {runSearchPage} from './SearchPageMain'
import {runFeedback} from './Feedback'
import {runDonateForm} from './DonateForm'
import {getParent} from './utils'
import {Grapher} from 'site/client/Grapher'
import {ChartView} from 'charts/ChartView'

declare var window: any
window.Grapher = Grapher
window.ChartView = ChartView
window.App = window.App || {}
window.runChartsIndexPage = runChartsIndexPage
window.runHeaderMenus = runHeaderMenus
window.runSearchPage = runSearchPage
window.runFeedback = runFeedback
window.runDonateForm = runDonateForm

Analytics.logEvent("OWID_PAGE_LOAD")

// tslint:disable-next-line:no-unused-expression
new SmoothScroll('a[href*="#"][data-smooth-scroll]', {
    speed: 300,
    durationMax: 500,
    durationMin: 100,
    popstate: false
})

const search = document.querySelector("form#search-nav") as HTMLFormElement
if (search) {
    const input = search.querySelector("input[type=search]") as HTMLInputElement
    search.addEventListener('submit', (ev) => {
        ev.preventDefault()
        Analytics.logEvent("OWID_SITE_SEARCH", { query: input.value }).then(() => search.submit()).catch(() => search.submit())
    })
}

const trackedLinkExists: boolean = !!document.querySelector("[data-track-click]")

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
    document.addEventListener("click", async (ev) => {
        const targetElement = ev.target as HTMLElement
        const trackedElement = getParent(targetElement, (el: HTMLElement) => el.getAttribute("data-track-click") != null)
        if (trackedElement) {
            // In order for events to be sent for anchor tags, there needs to be
            // a delay before navigating away from the page.
            const href = trackedElement.getAttribute("href")
            const target = trackedElement.getAttribute("target")
            if (href && target !== "_blank") {
                ev.preventDefault() // prevent immediate redirect
                const redirect = createFunctionWithTimeout(() => {
                    window.location = href
                })
                try {
                    await Analytics.logEvent("OWID_SITE_CLICK", {
                        text: trackedElement.innerText,
                        href: href,
                        note: trackedElement.getAttribute("data-track-note")
                    })
                } finally {
                    redirect()
                }
            } else {
                Analytics.logEvent("OWID_SITE_CLICK", {
                    text: trackedElement.innerText,
                    href: href,
                    note: trackedElement.getAttribute("data-track-note")
                })
            }
        }
    })
}
