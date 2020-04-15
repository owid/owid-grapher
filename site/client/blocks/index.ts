import { hydrate as hydrateAdditionalInformation } from "./AdditionalInformation/AdditionalInformation"
import { render as renderAdditionalInformation } from "./AdditionalInformation/AdditionalInformation"
import { render as renderHelp } from "./Help/Help"

export const renderBlocks = ($: CheerioStatic) => {
    renderAdditionalInformation($)
    renderHelp($)
}
export const runBlocks = () => {
    hydrateAdditionalInformation()
}
