import { JsonString } from "../domainTypes/Various.js"

export const ArchivedChartVersionsTableName = "archived_chart_versions"

export interface DbInsertArchivedChartVersion {
    archivalTimestamp: Date
    grapherId: number
    grapherSlug: string
    hashOfInputs: string
    manifest: JsonString
}

export interface DbPlainArchivedChartVersion
    extends Required<DbInsertArchivedChartVersion> {
    id: number
}

export interface DbEnrichedArchivedChartVersion
    extends Omit<DbPlainArchivedChartVersion, "manifest"> {
    manifest: Record<string, any> // TODO: Turn into more specific type
}
