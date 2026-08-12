import {
    ChartConfigsTableName,
    ChartDimensionsTableName,
    ChartRevisionsTableName,
    ChartSlugRedirectsTableName,
    ChartsTableName,
    DatasetsTableName,
    AdminApiKeysTableName,
    DbInsertChart,
    DbInsertChartConfig,
    ExplorerChartsTableName,
    ExplorerVariablesTableName,
    ExplorerViewDimensionsTableName,
    ExplorerViewsTableName,
    ExplorersTableName,
    GrapherInterface,
    JobsTableName,
    MultiDimDataPagesTableName,
    MultiDimRedirectsTableName,
    MultiDimViewDimensionsTableName,
    MultiDimXChartConfigsTableName,
    NarrativeChartsTableName,
    PostsGdocsTableName,
    TagGraphTableName,
    TagsTableName,
    UsersTableName,
    VariablesTableName,
} from "@ourworldindata/types"
import type { Knex } from "knex"
import { v7 as uuidv7 } from "uuid"

// the order is important here since we drop rows from the tables in this order
export const TABLES_IN_USE = [
    ChartDimensionsTableName,
    ChartRevisionsTableName,
    ChartSlugRedirectsTableName, // Must come before ChartsTableName due to foreign key
    NarrativeChartsTableName, // Must come before ChartsTableName, MultiDimXChartConfigsTableName and ChartConfigsTableName due to foreign keys
    MultiDimRedirectsTableName, // Must come before MultiDimDataPagesTableName and ChartConfigsTableName due to foreign keys
    MultiDimXChartConfigsTableName,
    MultiDimViewDimensionsTableName,
    MultiDimDataPagesTableName,
    ExplorerViewsTableName, // Must come before ExplorersTableName due to foreign key
    ExplorerViewDimensionsTableName,
    ExplorerChartsTableName, // Must come before ChartsTableName due to foreign key
    ExplorerVariablesTableName,
    ExplorersTableName,
    JobsTableName,
    ChartsTableName,
    VariablesTableName,
    ChartConfigsTableName,
    DatasetsTableName,
    PostsGdocsTableName,
    AdminApiKeysTableName,
    UsersTableName,
    TagGraphTableName,
    TagsTableName,
]

export async function cleanTestDb(
    knexInstance: Knex<any, unknown[]>
): Promise<void> {
    for (const table of TABLES_IN_USE) {
        await knexInstance.raw(`DELETE FROM ??`, [table])
    }
}

/** Inserts a chart_configs row and returns its id. */
export async function insertTestChartConfig(
    knexInstance: Knex<any, unknown[]>,
    config: GrapherInterface = {},
    id: string = uuidv7()
): Promise<string> {
    const row: DbInsertChartConfig = { id, config: JSON.stringify(config) }
    await knexInstance(ChartConfigsTableName).insert(row)
    return id
}

/**
 * Inserts the resolved and patch chart_configs rows together with the charts
 * row that owns them.
 */
export async function insertTestChart(
    knexInstance: Knex<any, unknown[]>,
    {
        config,
        lastEditedByUserId,
    }: { config?: GrapherInterface; lastEditedByUserId: number }
): Promise<{ chartId: number; configId: string; patchConfigId: string }> {
    const configId = await insertTestChartConfig(knexInstance, config)
    const patchConfigId = await insertTestChartConfig(knexInstance, config)
    const row: DbInsertChart = {
        configId,
        patchConfigId,
        lastEditedAt: new Date(),
        lastEditedByUserId,
    }
    const [chartId] = await knexInstance(ChartsTableName).insert(row)
    return { chartId, configId, patchConfigId }
}

export function sleep(time: number, value: unknown): Promise<any> {
    return new Promise((resolve) => {
        setTimeout(() => {
            return resolve(value)
        }, time)
    })
}
