import { SiteFooterContext } from "@ourworldindata/utils"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { hydrateProminentLink } from "./blocks/ProminentLink.js"
import { runCookiePreferencesManager } from "./CookiePreferencesManager.js"
import { hydrateDataPageV2Content } from "./DataPageV2Content.js"
import { runFootnotes } from "./Footnote.js"
import { hydrateOwidGdoc } from "./gdocs/OwidGdoc.js"
import { runLightbox } from "./Lightbox.js"
import { MultiEmbedderSingleton } from "./multiembedder/MultiEmbedder.js"
import { runSiteNavigation } from "./SiteNavigation.js"
import { runSiteTools } from "./SiteTools.js"
import { runDetailsOnDemand } from "./detailsOnDemand.js"
import { runDataTokens } from "./runDataTokens.js"
import { runSearchCountry } from "./SearchCountry.js"
import { hydrate as hydrateAdditionalInformation } from "./blocks/AdditionalInformation.js"
import { hydrateKeyInsights } from "./blocks/KeyInsights.js"
import { hydrateExpandableParagraphs } from "./blocks/ExpandableParagraph.js"
import { hydrateCodeSnippets } from "@ourworldindata/components"
import { hydrateStickyNav } from "./blocks/StickyNav.js"

export const runSiteFooterScripts = (
    args:
        | {
              debug?: boolean
              isPreviewing?: boolean
              context?: SiteFooterContext
              container?: HTMLElement
              hideDonationFlag?: boolean
          }
        | undefined
) => {
    // We used to destructure this in the function signature, but that caused
    // a weird issue reported by bugsnag: https://app.bugsnag.com/our-world-in-data/our-world-in-data-website/errors/63ca39b631e8660009464eb4?event_id=63d384c500acc25fc0810000&i=sk&m=ef
    // So now we define the object as potentially undefined and then destructure it here.
    const { debug, context, isPreviewing, hideDonationFlag } = args || {}

    switch (context) {
        case SiteFooterContext.dataPageV2:
            hydrateDataPageV2Content(isPreviewing)
            runLightbox()
            runSiteNavigation(BAKED_BASE_URL, hideDonationFlag)
            runSiteTools()
            runCookiePreferencesManager()
            runDetailsOnDemand()
            break
        case SiteFooterContext.grapherPage:
        case SiteFooterContext.explorerPage:
            runSiteNavigation(BAKED_BASE_URL, hideDonationFlag)
            runSiteTools()
            runCookiePreferencesManager()
            runDetailsOnDemand()
            break
        case SiteFooterContext.gdocsDocument:
            hydrateOwidGdoc(debug, isPreviewing)
            runSiteNavigation(BAKED_BASE_URL, hideDonationFlag)
            runFootnotes()
            runDetailsOnDemand()
            runLightbox()
            runSiteTools()
            runCookiePreferencesManager()
            break
        default:
            // Features that were not ported over to gdocs, are only being run on WP pages:
            // - global entity selector
            // - data tokens
            // - country-aware prominent links
            // - search country widget leading to topic country profiles
            // - embedding charts through MultiEmbedderSingleton.embedAll()
            runSiteNavigation(BAKED_BASE_URL, hideDonationFlag)
            runDataTokens()
            runSearchCountry()
            hydrateAdditionalInformation()
            hydrateKeyInsights()
            hydrateExpandableParagraphs()
            hydrateCodeSnippets()
            hydrateStickyNav()
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
