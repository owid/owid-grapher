import { hydrate as hydrateAdditionalInformation } from "./AdditionalInformation/AdditionalInformation"
import { render as renderAdditionalInformation } from "./AdditionalInformation/AdditionalInformation"

export const renderBlocks = ($: CheerioStatic) => {
    renderAdditionalInformation($)
}
export const runBlocks = () => {
    hydrateAdditionalInformation()
}
