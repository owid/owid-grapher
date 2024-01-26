import { JsonString } from "../domainTypes/Various.js"

export interface SourceDescription {
    dataPublishedBy?: string
    dataPublisherSource?: string
    link?: string
    retrievedDate?: string
    additionalInfo?: string
}

export const SourcesTableName = "sources"
export interface DbInsertSource {
    createdAt?: Date
    datasetId?: number | null
    description: JsonString
    id?: number
    name?: string | null
    updatedAt?: Date | null
}
export type DbRawSource = Required<DbInsertSource>
export type DbEnrichedSource = Omit<DbRawSource, "description"> & {
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

export function parseSourcesRow(row: DbRawSource): DbEnrichedSource {
    return { ...row, description: parseSourceDescription(row.description) }
}

export function serializeSourcesRow(row: DbEnrichedSource): DbRawSource {
    return {
        ...row,
        description: serializeSourceDescription(row.description),
    }
}
