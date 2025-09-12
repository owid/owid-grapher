import "@ourworldindata/grapher/src/core/grapher.scss"
import "./owid.scss"
// From https://fontawesome.com/how-to-use/on-the-web/other-topics/server-side-rendering:
// "If the CSS is missing when this icon displays in the browser it will flash
// from a very large icon down to a properly sized one a moment later."
import "@fortawesome/fontawesome-svg-core/styles.css"

import { ENV } from "../settings/clientSettings.js"
import {
    Grapher,
    renderSingleGrapherOnGrapherPage,
} from "@ourworldindata/grapher"
import { Explorer } from "@ourworldindata/explorer"
import { SiteAnalytics } from "./SiteAnalytics.js"
import { runMonkeyPatchForGoogleTranslate } from "./hacks.js"
import { runSiteFooterScriptsForArchive } from "./runSiteFooterScripts.js"

declare let window: any
window.Grapher = Grapher
window.Explorer = Explorer
window.renderSingleGrapherOnGrapherPage = renderSingleGrapherOnGrapherPage

// Note: do a text search of the project for "runSiteFooterScripts" to find the usage. todo: clean that up.
window.runSiteFooterScripts = runSiteFooterScriptsForArchive

runMonkeyPatchForGoogleTranslate()

const analytics = new SiteAnalytics(ENV)

document.documentElement?.classList.add("js-loaded")

analytics.startClickTracking()
