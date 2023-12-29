import { OwidLicense } from "./OwidVariable.js"
export interface OwidOrigin {
    id?: number
    title?: string
    titleSnapshot?: string
    attribution?: string
    attributionShort?: string
    versionProducer?: string
    license?: OwidLicense
    descriptionSnapshot?: string
    description?: string
    producer?: string
    citationFull?: string
    urlMain?: string
    urlDownload?: string
    dateAccessed?: string
    datePublished?: string
}
