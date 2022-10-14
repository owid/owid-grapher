import { GRAPHER_PAGE_BODY_CLASS } from "../grapher/core/GrapherConstants.js"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { runBlocks } from "./blocks/index.js"
import { hydrateProminentLink } from "./blocks/ProminentLink.js"
import { runCookiePreferencesManager } from "./CookiePreferencesManager.js"
import { runCovid } from "./covid/index.js"
import { runFootnotes } from "./Footnote.js"
import { runLightbox } from "./Lightbox.js"
import { MultiEmbedderSingleton } from "./multiembedder/MultiEmbedder.js"
import { runHeaderMenus } from "./SiteHeaderMenus.js"
import { runSiteTools } from "./SiteTools.js"

// Note: do a text search of the project for "runSiteFooterScripts" to find the usage. todo: clean that up.
export const runSiteFooterScripts = () => {
    runHeaderMenus(BAKED_BASE_URL)
    runBlocks()
    runLightbox()
    runSiteTools()
    runCookiePreferencesManager()
    runCovid()
    runFootnotes()
    if (!document.querySelector(`.${GRAPHER_PAGE_BODY_CLASS}`)) {
        MultiEmbedderSingleton.setUpGlobalEntitySelectorForEmbeds()
        MultiEmbedderSingleton.embedAll()
        hydrateProminentLink(MultiEmbedderSingleton.selection)
    } else {
        hydrateProminentLink()
    }
}
