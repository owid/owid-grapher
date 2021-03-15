import {
    hydrate as hydrateAdditionalInformation,
    render as renderAdditionalInformation,
} from "./AdditionalInformation"
import { renderHelp } from "./Help"
import { renderProminentLink } from "./ProminentLink"
import { runSearchCountry } from "../../site/SearchCountry"
import { runExpandableInlineBlock } from "../../site/ExpandableInlineBlock"
import { runDataTokens } from "../../site/runDataTokens"
import { shouldProgressiveEmbed } from "../../site/multiembedder/MultiEmbedder"

export const renderBlocks = (cheerioEl: CheerioStatic) => {
    renderAdditionalInformation(cheerioEl)
    renderHelp(cheerioEl)
}
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
}
