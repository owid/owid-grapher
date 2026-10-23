import { JsonString } from "../domainTypes/Various"

export const ExplorerViewsTableName = "explorer_views"
export interface DbInsertExplorerView {
    id?: number
    explorerSlug: string
    viewId: string
    dimensions: JsonString
    chartConfigId?: string | null // char(36) in database - UUID, null when error occurs
    error?: string | null // error message when configuration extraction fails
}

export type DbRawExplorerView = Required<DbInsertExplorerView>

export type DbEnrichedExplorerView = Omit<DbRawExplorerView, "dimensions"> & {
    dimensions: Record<string, string>
}

export function parseExplorerViewRow(
    row: Pick<DbRawExplorerView, "dimensions">
): Pick<DbEnrichedExplorerView, "dimensions"> {
    return {
        ...row,
        dimensions: JSON.parse(row.dimensions),
    }
}

export function serializeExplorerViewRow(
    row: DbEnrichedExplorerView
): DbRawExplorerView {
    return {
        ...row,
        dimensions: JSON.stringify(row.dimensions),
    }
}
