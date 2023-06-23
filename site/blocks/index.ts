import { hydrate as hydrateAdditionalInformation } from "./AdditionalInformation.js"
import { runSearchCountry } from "../../site/SearchCountry.js"
import { runDataTokens } from "../../site/runDataTokens.js"
import { hydrateKeyInsights } from "./KeyInsights.js"
import { hydrateStickyNav } from "./StickyNav.js"
import { hydrateExpandableParagraphs } from "./ExpandableParagraph.js"
import { hydrateCodeSnippets } from "./CodeSnippet.js"
import { SiteFooterContext } from "@ourworldindata/utils"

export const runBlocks = (context?: SiteFooterContext) => {
    runDataTokens()
    runSearchCountry()
    hydrateAdditionalInformation()
    if (context !== SiteFooterContext.gdocsDocument) {
        // These blocks already get hydrated by hydrateOwidGdoc, hydrating twice breaks things
        hydrateKeyInsights()
        hydrateExpandableParagraphs()
        hydrateCodeSnippets()
    }
    hydrateStickyNav()
}
