import { SiteFooterContext } from "@ourworldindata/utils"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { runBlocks } from "./blocks/index.js"
import { hydrateProminentLink } from "./blocks/ProminentLink.js"
import { runCookiePreferencesManager } from "./CookiePreferencesManager.js"
import { hydrateDataPageContent } from "./DataPageContent.js"
import { runFootnotes } from "./Footnote.js"
import { hydrateOwidGdoc } from "./gdocs/OwidGdoc.js"
import { runLightbox } from "./Lightbox.js"
import { MultiEmbedderSingleton } from "./multiembedder/MultiEmbedder.js"
import { runSiteNavigation } from "./SiteNavigation.js"
import { runSiteTools } from "./SiteTools.js"
import { runDetailsOnDemand } from "./detailsOnDemand.js"

export const runSiteFooterScripts = (
    args:
        | {
              debug?: boolean
              isPreviewing?: boolean
              context?: SiteFooterContext
              container?: HTMLElement
          }
        | undefined
) => {
    // We used to destructure this in the function signature, but that caused
    // a weird issue reported by bugsnag: https://app.bugsnag.com/our-world-in-data/our-world-in-data-website/errors/63ca39b631e8660009464eb4?event_id=63d384c500acc25fc0810000&i=sk&m=ef
    // So now we define the object as potentially undefined and then destructure it here.
    const { debug, context, isPreviewing } = args || {}

    switch (context) {
        case SiteFooterContext.dataPage:
            hydrateDataPageContent()
        case SiteFooterContext.grapherPage:
        case SiteFooterContext.explorerPage:
            runSiteNavigation(BAKED_BASE_URL)
            runSiteTools()
            runCookiePreferencesManager()
            runDetailsOnDemand()
            break
        case SiteFooterContext.gdocsDocument:
            hydrateOwidGdoc(debug, isPreviewing)
        // no break here, we additionally want to run the default scripts
        default:
            runSiteNavigation(BAKED_BASE_URL)
            runBlocks()
            MultiEmbedderSingleton.setUpGlobalEntitySelectorForEmbeds()
            MultiEmbedderSingleton.embedAll()
            runLightbox()
            hydrateProminentLink(MultiEmbedderSingleton.selection)
            runFootnotes()
            runSiteTools()
            runCookiePreferencesManager()
            runDetailsOnDemand()
            break
    }
}
