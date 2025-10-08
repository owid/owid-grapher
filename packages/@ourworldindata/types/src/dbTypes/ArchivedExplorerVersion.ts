import { JsonString } from "../domainTypes/Various.js"

export const ArchivedExplorerVersionsTableName = "archived_explorer_versions"

export interface DbInsertArchivedExplorerVersion {
    archivalTimestamp: Date
    explorerSlug: string
    hashOfInputs: string
    manifest: JsonString
}

export interface DbPlainArchivedExplorerVersion
    extends Required<DbInsertArchivedExplorerVersion> {
    id: number
}

export interface DbEnrichedArchivedExplorerVersion
    extends Omit<DbPlainArchivedExplorerVersion, "manifest"> {
    manifest: Record<string, any> // TODO: Turn into more specific type
}
