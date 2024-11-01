import {
    ChartConfigsTableName,
    ChartDimensionsTableName,
    ChartRevisionsTableName,
    ChartsTableName,
    DatasetsTableName,
    MultiDimDataPagesTableName,
    MultiDimXChartConfigsTableName,
    PostsGdocsTableName,
    UsersTableName,
    VariablesTableName,
} from "@ourworldindata/types"
import { Knex } from "knex"

// the order is important here since we drop rows from the tables in this order
export const TABLES_IN_USE = [
    ChartDimensionsTableName,
    ChartRevisionsTableName,
    ChartsTableName,
    MultiDimXChartConfigsTableName,
    MultiDimDataPagesTableName,
    VariablesTableName,
    ChartConfigsTableName,
    DatasetsTableName,
    PostsGdocsTableName,
    UsersTableName,
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
