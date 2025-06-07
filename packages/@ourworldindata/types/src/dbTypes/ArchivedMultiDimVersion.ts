import { JsonString } from "../domainTypes/Various.js"

export const ArchivedMultiDimVersionsTableName = "archived_multi_dim_versions"

export interface DbInsertArchivedMultiDimVersion {
    archivalTimestamp: Date
    multiDimId: number
    multiDimSlug: string
    hashOfInputs: string
    manifest: JsonString
}

export interface DbPlainArchivedMultiDimVersion
    extends Required<DbInsertArchivedMultiDimVersion> {
    id: number
}

export interface DbEnrichedArchivedMultiDimVersion
    extends Omit<DbPlainArchivedMultiDimVersion, "manifest"> {
    manifest: Record<string, any> // TODO: Turn into more specific type
}
