// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "./instrument.js"

import "@ourworldindata/grapher/src/core/grapher.scss"
import "./owid.scss"
// From https://fontawesome.com/how-to-use/on-the-web/other-topics/server-side-rendering:
// "If the CSS is missing when this icon displays in the browser it will flash
// from a very large icon down to a properly sized one a moment later."
import "@fortawesome/fontawesome-svg-core/styles.css"

import { runNotFoundPage } from "./NotFoundPageMain.js"
import { runFeedbackPage } from "./Feedback.js"
import { runDonateForm } from "./runDonateForm.js"
import { runCountryProfilePage } from "./runCountryProfilePage.js"
import { runTableOfContents } from "./runTableOfContents.js"
import { Explorer } from "@ourworldindata/explorer"
import { ENV, ADMIN_BASE_URL } from "../settings/clientSettings.js"
import {
    Grapher,
    CookieKey,
    renderSingleGrapherOnGrapherPage,
} from "@ourworldindata/grapher"
import { MultiEmbedderSingleton } from "../site/multiembedder/MultiEmbedder.js"
import { CoreTable } from "@ourworldindata/core-table"
import { SiteAnalytics } from "./SiteAnalytics.js"
import { runMonkeyPatchForGoogleTranslate } from "./hacks.js"
import { runSiteFooterScripts } from "./runSiteFooterScripts.js"

declare let window: any
window.Grapher = Grapher
window.Explorer = Explorer
window.CoreTable = CoreTable
window.runNotFoundPage = runNotFoundPage
window.runFeedbackPage = runFeedbackPage
window.runDonateForm = runDonateForm
window.runCountryProfilePage = runCountryProfilePage
window.runTableOfContents = runTableOfContents
window.renderSingleGrapherOnGrapherPage = renderSingleGrapherOnGrapherPage
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
            }
        }
    }
} catch {
    // ignore
}

analytics.startClickTracking()
