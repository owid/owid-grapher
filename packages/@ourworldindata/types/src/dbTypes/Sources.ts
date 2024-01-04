import { JsonString } from "../domainTypes/Various.js"

export interface SourceDescription {
    dataPublishedBy?: string
    dataPublisherSource?: string
    link?: string
    retrievedDate?: string
    additionalInfo?: string
}

export const SourcesRowTableName = "sources"
export interface SourcesRowForInsert {
    createdAt?: Date
    datasetId?: number | null
    description: JsonString
    id?: number
    name?: string | null
    updatedAt?: Date | null
}
export type SourcesRowRaw = Required<SourcesRowForInsert>
export type SourcesRowEnriched = Omit<SourcesRowRaw, "description"> & {
    description: SourceDescription
}

export function parseSourceDescription(
    description: JsonString
): SourceDescription {
    return JSON.parse(description)
}

export function serializeSourceDescription(
    description: SourceDescription
): JsonString {
    return JSON.stringify(description)
}

export function parseSourcesRow(row: SourcesRowRaw): SourcesRowEnriched {
    return { ...row, description: parseSourceDescription(row.description) }
}

export function serializeSourcesRow(row: SourcesRowEnriched): SourcesRowRaw {
    return {
        ...row,
        description: serializeSourceDescription(row.description),
    }
}
