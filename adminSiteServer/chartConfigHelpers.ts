import {
    ChartConfigsTableName,
    DbRawChartConfig,
    GrapherInterface,
    R2GrapherConfigDirectory,
} from "@ourworldindata/types"
import * as db from "../db/db.js"
import {
    insertChartConfig,
    updateChartConfig,
} from "../db/model/ChartConfigs.js"
import {
    deleteGrapherConfigFromR2ByUUID,
    saveGrapherConfigToR2,
    saveGrapherConfigToR2ByUUID,
} from "../serverUtils/r2/chartConfigR2Helpers.js"

export interface ChartConfigPair {
    config: GrapherInterface
    patchConfig: GrapherInterface
}

/**
 * One particular detail of of MySQL's JSON support is that MySQL _normalizes_ JSON when storing it.
 * This means that the JSON string representation of a JSON object stored in MySQL is not equivalent
 * to the input of an INSERT statement: it may have different whitespace and key order.
 * This is a problem when we compute MD5 hashes of JSON objects using computed MySQL columns - in
 * order to get the correct hash, we need to first store the JSON object in MySQL and then retrieve
 * it and its hash again from MySQL immediately afterwards, such that we can store the exact same
 * JSON representation and hash in R2 also.
 * The below is a helper function that does just this.
 * - @marcelgerber, 2024-11-20
 */

export const retrieveChartConfigFromDbAndSaveToR2 = async (
    knex: db.KnexReadonlyTransaction,
    chartConfigId: string,
    r2Path?: { directory: R2GrapherConfigDirectory; filename: string }
) => {
    // We need to get the config and the md5 hash from the database instead of
    // computing our own md5 hash because MySQL normalizes JSON and our
    // client computed md5 would be different from the ones computed by and stored in R2
    const row: Pick<DbRawChartConfig, "config" | "configMd5"> = await knex(
        ChartConfigsTableName
    )
        .select("config", "configMd5")
        .where({ id: chartConfigId })
        .first()

    if (!row)
        throw new Error(
            `Chart config not found in the database! id=${chartConfigId}`
        )

    if (!r2Path) {
        await saveGrapherConfigToR2ByUUID(
            chartConfigId,
            row.config,
            row.configMd5
        )
    } else {
        await saveGrapherConfigToR2(
            row.config,
            r2Path.directory,
            r2Path.filename,
            row.configMd5
        )
    }

    return {
        chartConfigId,
        config: row.config,
        configMd5: row.configMd5,
    }
}

const updateChartConfigInDbAndR2 = async (
    knex: db.KnexReadWriteTransaction,
    configId: string,
    config: GrapherInterface,
    updatedAt: Date = new Date()
) => {
    await updateChartConfig(knex, { configId, config, updatedAt })
    return retrieveChartConfigFromDbAndSaveToR2(knex, configId)
}

/** Inserts a chart config pair without publishing */
export const insertChartConfigPair = async (
    knex: db.KnexReadWriteTransaction,
    { config, patchConfig }: ChartConfigPair,
    now: Date = new Date()
): Promise<{ chartConfigId: string; patchConfigId: string }> => {
    const chartConfigId = await insertChartConfig(knex, {
        config,
        createdAt: now,
        updatedAt: now,
    })
    const patchConfigId = await insertChartConfig(knex, {
        config: patchConfig,
        createdAt: now,
        updatedAt: now,
    })
    return { chartConfigId, patchConfigId }
}

export const saveNewChartConfigPairInDbAndR2 = async (
    knex: db.KnexReadWriteTransaction,
    pair: ChartConfigPair,
    now: Date = new Date()
) => {
    const ids = await insertChartConfigPair(knex, pair, now)
    await retrieveChartConfigFromDbAndSaveToR2(knex, ids.chartConfigId)
    return ids
}

export const updateChartConfigPairInDbAndR2 = async (
    knex: db.KnexReadWriteTransaction,
    {
        configId,
        patchConfigId,
        config,
        patchConfig,
    }: ChartConfigPair & { configId: string; patchConfigId: string },
    now: Date = new Date()
) => {
    await updateChartConfig(knex, {
        configId: patchConfigId,
        config: patchConfig,
        updatedAt: now,
    })
    return updateChartConfigInDbAndR2(knex, configId, config, now)
}

export const deleteChartConfigPairFromDbAndR2 = async (
    knex: db.KnexReadWriteTransaction,
    { configId, patchConfigId }: { configId: string; patchConfigId: string }
) => {
    await knex(ChartConfigsTableName)
        .whereIn("id", [configId, patchConfigId])
        .delete()
    // Only the resolved config was published
    await deleteGrapherConfigFromR2ByUUID(configId)
}
