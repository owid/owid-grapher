import { JsonString } from "../domainTypes/Various"
import { GrapherInterface } from "../grapherTypes/GrapherTypes"
import { parseChartConfig, serializeChartConfig } from "./ChartConfigs"

export const ExplorerViewsTableName = "explorer_views"
export interface DbInsertExplorerView {
    id?: number
    explorerSlug: string
    explorerView: JsonString
    grapherConfig: JsonString
}

export type DbRawExplorerView = Required<DbInsertExplorerView>

export type DbEnrichedExplorerView = Omit<
    DbRawExplorerView,
    "explorerView" | "grapherConfig"
> & {
    explorerView: Record<string, string>
    grapherConfig: GrapherInterface
}

export function parseExplorerViewRow(
    row: Pick<DbRawExplorerView, "explorerView" | "grapherConfig">
): Pick<DbEnrichedExplorerView, "explorerView" | "grapherConfig"> {
    return {
        ...row,
        explorerView: JSON.parse(row.explorerView),
        grapherConfig: parseChartConfig(row.grapherConfig),
    }
}

export function serializeChartsRow(
    row: DbEnrichedExplorerView
): DbRawExplorerView {
    return {
        ...row,
        explorerView: JSON.stringify(row.explorerView),
        grapherConfig: serializeChartConfig(row.grapherConfig),
    }
}
