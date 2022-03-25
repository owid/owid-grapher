import { hydrate as hydrateAdditionalInformation } from "./AdditionalInformation.js"
import { runSearchCountry } from "../../site/SearchCountry.js"
import { runExpandableInlineBlock } from "../../site/ExpandableInlineBlock.js"
import { runDataTokens } from "../../site/runDataTokens.js"
import { shouldProgressiveEmbed } from "../../site/multiembedder/MultiEmbedder.js"
import { hydrateQuickInsights } from "./QuickInsights.js"

export const runBlocks = () => {
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
    hydrateAdditionalInformation()
    hydrateQuickInsights()
}
