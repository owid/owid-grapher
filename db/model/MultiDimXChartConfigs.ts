import {
    DbInsertMultiDimXChartConfig,
    MultiDimXChartConfigsTableName,
} from "@ourworldindata/types"
import { KnexReadWriteTransaction } from "../db.js"

export async function upsertMultiDimXChartConfigs(
    knex: KnexReadWriteTransaction,
    data: DbInsertMultiDimXChartConfig
): Promise<number> {
    const result = await knex<DbInsertMultiDimXChartConfig>(
        MultiDimXChartConfigsTableName
    )
        .insert(data)
        .onConflict()
        .merge()
    return result[0]
}
