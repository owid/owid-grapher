import { SiteFooterContext } from "@ourworldindata/utils"
import { BAKED_BASE_URL } from "../settings/siteClientSettings.js"
import { runBlocks } from "./blocks/index.js"
import { hydrateProminentLink } from "./blocks/ProminentLink.js"
import { runCookiePreferencesManager } from "./CookiePreferencesManager.js"
import { runCovid } from "./covid/index.js"
import { runFootnotes } from "./Footnote.js"
import { hydrateOwidArticle } from "./gdocs/OwidArticle.js"
import { runLightbox } from "./Lightbox.js"
import { MultiEmbedderSingleton } from "./multiembedder/MultiEmbedder.js"
import { runHeaderMenus } from "./SiteHeaderMenus.js"
import { runSiteTools } from "./SiteTools.js"

export const runSiteFooterScripts = ({
    debug,
    context,
    container,
}: {
    debug?: boolean
    context?: SiteFooterContext
    container?: HTMLElement
}) => {
    switch (context) {
        case SiteFooterContext.gdocsPreview:
            runBlocks()
            runLightbox()
            runFootnotes()
            // We need to observe figures within the preview iframe DOM
            MultiEmbedderSingleton.observeFigures(container)
            break
        case SiteFooterContext.grapherPage:
        case SiteFooterContext.explorerPage:
            runHeaderMenus(BAKED_BASE_URL)
            runSiteTools()
            runCookiePreferencesManager()
            break
        case SiteFooterContext.gdocsArticle:
            hydrateOwidArticle(debug)
        // no break here, we additionally want to run the default scripts
        default:
            runHeaderMenus(BAKED_BASE_URL)
            runBlocks()
            MultiEmbedderSingleton.setUpGlobalEntitySelectorForEmbeds()
            MultiEmbedderSingleton.embedAll()
            runLightbox()
            hydrateProminentLink(MultiEmbedderSingleton.selection)
            runFootnotes()
            runSiteTools()
            runCookiePreferencesManager()
            runCovid()
            break
    }
}
