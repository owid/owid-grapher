import { JsonString } from "../domainTypes/Various.js"
import { License, parseLicense, serializeLicense } from "./Variables.js"

export const OriginsTableName = "origins"
export interface OriginsRowForInsert {
    attribution?: string | null
    attributionShort?: string | null
    citationFull?: string | null
    dateAccessed?: Date | null
    datePublished?: string | null
    description?: string | null
    descriptionSnapshot?: string | null
    id?: number
    license?: JsonString | null
    producer?: string | null
    title?: string | null
    titleSnapshot?: string | null
    urlDownload?: string | null
    urlMain?: string | null
    versionProducer?: string | null
}
export type OriginsRowRaw = Required<OriginsRowForInsert>
export type OriginsRowEnriched = Omit<OriginsRowRaw, "license"> & {
    license: License | null
}

export function parseOriginsRow(row: OriginsRowRaw): OriginsRowEnriched {
    return { ...row, license: parseLicense(row.license) }
}

export function serializeOriginsRow(row: OriginsRowEnriched): OriginsRowRaw {
    return { ...row, license: serializeLicense(row.license) }
}
