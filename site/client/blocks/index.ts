import { hydrate as hydrateAdditionalInformation } from "./AdditionalInformation/AdditionalInformation"
import { render as renderAdditionalInformation } from "./AdditionalInformation/AdditionalInformation"
import { render as renderHelp } from "./Help/Help"
import { shouldProgressiveEmbed } from "../Grapher"

export const renderBlocks = ($: CheerioStatic) => {
    renderAdditionalInformation($)
    renderHelp($)
}
export const runBlocks = () => {
    if (!shouldProgressiveEmbed()) {
        // Used by Help blocks. Pierces encapsulation but considered not worth going through hydration / client side rendering for this.
        // If hydration required for other purposes, then reassess.
        document
            .getElementsByTagName("body")[0]
            .classList.add("is-not-chart-interactive")
    }
    hydrateAdditionalInformation()
}
