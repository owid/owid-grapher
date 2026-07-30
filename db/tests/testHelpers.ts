import {
    ChartConfigsTableName,
    ChartDimensionsTableName,
    ChartRevisionsTableName,
    ChartSlugRedirectsTableName,
    ChartsTableName,
    DatasetsTableName,
    AdminApiKeysTableName,
    ExplorerChartsTableName,
    ExplorerVariablesTableName,
    ExplorerViewsTableName,
    ExplorersTableName,
    JobsTableName,
    MultiDimDataPagesTableName,
    MultiDimRedirectsTableName,
    MultiDimXChartConfigsTableName,
    PostsGdocsTableName,
    TagGraphTableName,
    TagsTableName,
    UsersTableName,
    VariablesTableName,
} from "@ourworldindata/types"
import type { Knex } from "knex"

// the order is important here since we drop rows from the tables in this order
export const TABLES_IN_USE = [
    ChartDimensionsTableName,
    ChartRevisionsTableName,
    ChartSlugRedirectsTableName, // Must come before ChartsTableName due to foreign key
    MultiDimRedirectsTableName, // Must come before MultiDimDataPagesTableName and ChartConfigsTableName due to foreign keys
    MultiDimXChartConfigsTableName,
    MultiDimDataPagesTableName,
    ExplorerViewsTableName, // Must come before ExplorersTableName due to foreign key
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

export function sleep(time: number, value: unknown): Promise<any> {
    return new Promise((resolve) => {
        setTimeout(() => {
            return resolve(value)
        }, time)
    })
}
