import { JsonString } from "../domainTypes/Various"

export const ExplorerViewsTableName = "explorer_views"
export interface DbInsertExplorerView {
    id?: number
    explorerSlug: string
    explorerView: JsonString
    chartConfigId?: string // char(36) in database - UUID, nullable when error occurs
    error?: string // error message when configuration extraction fails
}

export type DbRawExplorerView = Required<
    Omit<DbInsertExplorerView, "chartConfigId" | "error">
> & {
    chartConfigId: string | null
    error: string | null
}

export type DbEnrichedExplorerView = Omit<DbRawExplorerView, "explorerView"> & {
    explorerView: Record<string, string>
}

export function parseExplorerViewRow(
    row: Pick<DbRawExplorerView, "explorerView">
): Pick<DbEnrichedExplorerView, "explorerView"> {
    return {
        ...row,
        explorerView: JSON.parse(row.explorerView),
    }
}

export function serializeExplorerViewRow(
    row: DbEnrichedExplorerView
): DbRawExplorerView {
    return {
        ...row,
        explorerView: JSON.stringify(row.explorerView),
    }
}
