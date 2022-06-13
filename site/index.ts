import { hydrate as hydrateAdditionalInformation } from "./blocks/AdditionalInformation.js"
import { runSearchCountry } from "./SearchCountry.js"
import { runExpandableInlineBlock } from "./ExpandableInlineBlock.js"
import { runDataTokens } from "./runDataTokens.js"
import {
    MultiEmbedderSingleton,
    shouldProgressiveEmbed,
} from "./multiembedder/MultiEmbedder.js"
import { runHeaderMenus } from "./SiteHeaderMenus.js"
import { runCookiePreferencesManager } from "./CookiePreferencesManager.js"
import { runLightbox } from "./Lightbox.js"
import { runSiteTools } from "./SiteTools.js"
import { runCovid } from "./covid/index.js"
import { runFootnotes } from "./Footnote.js"

import { runSearchGraph } from "./SearchGraph.js"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { GRAPHER_PAGE_BODY_CLASS } from "../grapher/core/GrapherConstants.js"
import {
    hydrateProminentLink,
    PROMINENT_LINK_CLASSNAME,
} from "./blocks/ProminentLink.js"
import Glightbox from "glightbox"

export const runSiteFooterScripts = () => {
    runHeaderMenus(BAKED_BASE_URL)
    if (!shouldProgressiveEmbed()) {
        // Used by Help blocks. Pierces encapsulation but considered not worth going through hydration / client side rendering for this.
        // If hydration required for other purposes, then reassess.
        document
            .getElementsByTagName("body")[0]
            .classList.add("is-not-chart-interactive")
    }
    runDataTokens()
    runExpandableInlineBlock()
    runSearchCountry()
    runSearchGraph()
    hydrateAdditionalInformation()
    runLightbox()
    runSiteTools()
    runCookiePreferencesManager()
    runCovid()
    runFootnotes()
    if (!document.querySelector(`.${GRAPHER_PAGE_BODY_CLASS}`)) {
        MultiEmbedderSingleton.setUpGlobalEntitySelectorForEmbeds()
        MultiEmbedderSingleton.embedAll()
        hydrateProminentLink(
            MultiEmbedderSingleton.selection,
            Glightbox({ selector: `.${PROMINENT_LINK_CLASSNAME} a` })
        )
    } else {
        hydrateProminentLink()
    }
}
