// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "./instrument.js"

import "@ourworldindata/grapher/src/core/grapher.scss"
import "./owid.scss"
// From https://fontawesome.com/how-to-use/on-the-web/other-topics/server-side-rendering:
// "If the CSS is missing when this icon displays in the browser it will flash
// from a very large icon down to a properly sized one a moment later."
import "@fortawesome/fontawesome-svg-core/styles.css"

import React from "react"
import { createRoot } from "react-dom/client"
import { runNotFoundPage } from "./NotFoundPageMain.js"
import { runFeedbackPage } from "./Feedback.js"
import { runDonateForm } from "./runDonateForm.js"
import { runTableOfContents } from "./runTableOfContents.js"
import { Explorer } from "@ourworldindata/explorer"
import { ENV } from "../settings/clientSettings.js"
import {
    Grapher,
    renderSingleGrapherOnGrapherPage,
    GrapherState,
} from "@ourworldindata/grapher"
import { MultiEmbedderSingleton } from "../site/multiembedder/MultiEmbedder.js"
import { CoreTable, OwidTable } from "@ourworldindata/core-table"
import { SiteAnalytics } from "./SiteAnalytics.js"
import { runMonkeyPatchForGoogleTranslate } from "./hacks.js"
import { runSiteFooterScripts } from "./runSiteFooterScripts.js"

declare let window: any
window.Grapher = Grapher
window.GrapherState = GrapherState
window.Explorer = Explorer
window.CoreTable = CoreTable
window.OwidTable = OwidTable
window.React = React
window.createRoot = createRoot
window.runNotFoundPage = runNotFoundPage
window.runFeedbackPage = runFeedbackPage
window.runDonateForm = runDonateForm
window.runTableOfContents = runTableOfContents
window.renderSingleGrapherOnGrapherPage = renderSingleGrapherOnGrapherPage
window.MultiEmbedderSingleton = MultiEmbedderSingleton

// Note: do a text search of the project for "runSiteFooterScripts" to find the usage. todo: clean that up.
window.runSiteFooterScripts = runSiteFooterScripts

runMonkeyPatchForGoogleTranslate()

const analytics = new SiteAnalytics(ENV)

document.documentElement?.classList.add("js-loaded")

analytics.startClickTracking()
analytics.startDetectingBrowserTranslation()
