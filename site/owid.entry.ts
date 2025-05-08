// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "./instrument.js"

import "@ourworldindata/grapher/src/core/grapher.scss"
import "./owid.scss"
// From https://fontawesome.com/how-to-use/on-the-web/other-topics/server-side-rendering:
// "If the CSS is missing when this icon displays in the browser it will flash
// from a very large icon down to a properly sized one a moment later."
import "@fortawesome/fontawesome-svg-core/styles.css"

import { runSearchPage } from "./search/runSearchPage.js"
import { runNotFoundPage } from "./NotFoundPageMain.js"
import { runFeedbackPage } from "./Feedback.js"
import { runDonateForm } from "./runDonateForm.js"
import { runCountryProfilePage } from "./runCountryProfilePage.js"
import { runTableOfContents } from "./runTableOfContents.js"
import { Explorer } from "@ourworldindata/explorer"
import { ENV, ADMIN_BASE_URL } from "../settings/clientSettings.js"
import { Grapher, CookieKey } from "@ourworldindata/grapher"
import { MultiEmbedderSingleton } from "../site/multiembedder/MultiEmbedder.js"
import { CoreTable } from "@ourworldindata/core-table"
import { SiteAnalytics } from "./SiteAnalytics.js"
import { runMonkeyPatchForGoogleTranslate } from "./hacks.js"
import { runSiteFooterScripts } from "./runSiteFooterScripts.js"

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

                // New code for pageviews:
                // gdocAdminBar is available from the outer scope, and id is available from the current scope.
                const pageviewSpan = document.createElement("span")
                pageviewSpan.id = "gdoc-pageviews"
                // Add some spacing, and the " | " separator manually for now.
                // Styles can be adjusted later via CSS if needed.
                pageviewSpan.style.marginLeft = "5px"
                pageviewSpan.textContent = "| Loading pageviews..." // Initial text
                gdocAdminBar.appendChild(pageviewSpan)

                const currentPath = window.location.pathname
                const currentPageUrl = `https://ourworldindata.org${currentPath}`
                const analyticsUrl = `http://analytics/analytics/pages.json?_sort=rowid&url__exact=${encodeURIComponent(currentPageUrl)}`

                fetch(analyticsUrl)
                    .then((res) => {
                        if (!res.ok) {
                            // This can happen if analytics server is down or user not on Tailscale.
                            throw new Error(`HTTP error ${res.status}`)
                        }
                        return res.json()
                    })
                    .then((data) => {
                        if (data.rows && data.rows.length > 0 && data.columns) {
                            const row = data.rows[0]
                            const views7dIndex =
                                data.columns.indexOf("views_7d")
                            const views365dIndex =
                                data.columns.indexOf("views_365d")

                            if (views7dIndex !== -1 && views365dIndex !== -1) {
                                const sevenDayTotal = row[views7dIndex]
                                const yearTotal = row[views365dIndex]
                                if (
                                    typeof sevenDayTotal === "number" &&
                                    typeof yearTotal === "number"
                                ) {
                                    const avg7Day = Math.round(
                                        sevenDayTotal / 7
                                    )
                                    const avg365Day = Math.round(
                                        yearTotal / 365
                                    )
                                    pageviewSpan.textContent = `| PVs (7d): ${avg7Day}, (365d): ${avg365Day}`
                                } else {
                                    pageviewSpan.textContent =
                                        "| Pageview data format error"
                                }
                            } else {
                                pageviewSpan.textContent =
                                    "| Pageview fields not found"
                            }
                        } else {
                            pageviewSpan.textContent =
                                "| Pageview data not available"
                        }
                    })
                    .catch((err) => {
                        console.error("Error fetching pageviews:", err)
                        pageviewSpan.textContent = "| Error loading pageviews"
                    })
            }
        }
    }
} catch {
    // ignore
}

analytics.startClickTracking()
