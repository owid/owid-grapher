import { JsonString } from "../domainTypes/Various.js"
import { License, parseLicense, serializeLicense } from "./Variables.js"

export const OriginsTableName = "origins"
export interface DbInsertOrigin {
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
export type DbRawOrigin = Required<DbInsertOrigin>
export type DbEnrichedOrigin = Omit<DbRawOrigin, "license"> & {
    license: License | null
}

export function parseOriginsRow(row: DbRawOrigin): DbEnrichedOrigin {
    return { ...row, license: parseLicense(row.license) }
}

export function serializeOriginsRow(row: DbEnrichedOrigin): DbRawOrigin {
    return { ...row, license: serializeLicense(row.license) }
}
