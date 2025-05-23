import {
    DbPlainMultiDimDataPage,
    MultiDimDataPagesTableName,
} from "@ourworldindata/types"
import { knexReadWriteTransaction, TransactionCloseMode } from "../../db/db.js"
import { upsertMultiDim } from "../../adminSiteServer/multiDim.js"

/**
 * Migrates the old multi-dim config to a normalized format, creates related
 * records in `chart_configs` and the `multi_dim_x_chart_configs` tables and
 * uploads the full chart config of each view and the multi-dim config to R2.
 *
 * The old config must be valid, otherwise the migration will fail.
 */
async function main() {
    await knexReadWriteTransaction(async (knex) => {
        const results = await knex<DbPlainMultiDimDataPage>(
            MultiDimDataPagesTableName
        ).select("catalogPath", "config")
        for (const { catalogPath, config } of results) {
            await upsertMultiDim(knex, catalogPath, JSON.parse(config))
        }
    }, TransactionCloseMode.Close)
}

void main()
