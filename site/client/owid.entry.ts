import 'site/client/owid.scss'
import 'charts/client/chart.scss'
import './oldScripts.js'
// From https://fontawesome.com/how-to-use/on-the-web/other-topics/server-side-rendering:
// "If the CSS is missing when this icon displays in the browser it will flash
// from a very large icon down to a properly sized one a moment later."
import '@fortawesome/fontawesome-svg-core/styles.css'

import {Analytics} from './Analytics'
import {runChartsIndexPage} from './runChartsIndexPage'
import {runHeaderMenus} from './SiteHeaderMenus'
import {getParent} from './utils'
import {Grapher} from 'site/client/Grapher'
import {ChartView} from 'charts/ChartView'
window.Grapher = Grapher
window.ChartView = ChartView
window.App = window.App || {}

Analytics.logEvent("OWID_PAGE_LOAD")

const search = document.querySelector("form#search-nav") as HTMLFormElement
if (search) {
    const input = search.querySelector("input[type=search]") as HTMLInputElement
    const lastQuery = ""
    search.addEventListener('submit', (ev) => {
        ev.preventDefault()
        Analytics.logEvent("OWID_SITE_SEARCH", { query: input.value }).then(() => search.submit()).catch(() => search.submit())
    })
}

const trackedLinkExists: boolean = !!document.querySelector("a[data-track-click]")

if (trackedLinkExists) {
    document.addEventListener("click", (ev) => {
        const targetElement = ev.target as HTMLElement
        const trackedElement = getParent(targetElement, (el: HTMLElement) => el.getAttribute("data-track-click") != null)
        if (trackedElement) {
            // Note this will not work on anchor tags without target=_blank, as
            // they immediately navigate away before the event can be sent.
            // To handle those we need to wait before navigating.
            Analytics.logEvent("OWID_SITE_CLICK", {
                text: trackedElement.innerText,
                href: trackedElement.getAttribute("href")
            })
        }
    })
}

declare var window: any

window.runChartsIndexPage = runChartsIndexPage
window.runHeaderMenus = runHeaderMenus