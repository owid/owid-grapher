import { OwidLicense } from "./OwidVariable.js"
export interface OwidOrigin {
    id?: number
    datasetTitleProducer?: string
    datasetTitleOwid?: string
    attribution?: string
    attributionShort?: string
    version?: string
    license?: OwidLicense
    datasetDescriptionOwid?: string
    datasetDescriptionProducer?: string
    producer?: string
    citationProducer?: string
    datasetUrlMain?: string
    datasetUrlDownload?: string
    dateAccessed?: Date
    datePublished?: string
}
