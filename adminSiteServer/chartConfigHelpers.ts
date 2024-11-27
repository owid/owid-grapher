import {
    Base64String,
    ChartConfigsTableName,
    DbInsertChartConfig,
    DbRawChartConfig,
    GrapherInterface,
    R2GrapherConfigDirectory,
    serializeChartConfig,
} from "@ourworldindata/types"
import { uuidv7 } from "uuidv7"
import * as db from "../db/db.js"
import {
    saveGrapherConfigToR2,
    saveGrapherConfigToR2ByUUID,
} from "./chartConfigR2Helpers.js"

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
    chartConfigId: Base64String,
    r2Path?: { directory: R2GrapherConfigDirectory; filename: string }
) => {
    // We need to get the full config and the md5 hash from the database instead of
    // computing our own md5 hash because MySQL normalizes JSON and our
    // client computed md5 would be different from the ones computed by and stored in R2
    const fullConfigMd5: Pick<DbRawChartConfig, "full" | "fullMd5"> =
        await knex(ChartConfigsTableName)
            .select("full", "fullMd5")
            .where({ id: chartConfigId })
            .first()

    if (!fullConfigMd5)
        throw new Error(
            `Chart config not found in the database! id=${chartConfigId}`
        )

    if (!r2Path) {
        await saveGrapherConfigToR2ByUUID(
            chartConfigId,
            fullConfigMd5.full,
            fullConfigMd5.fullMd5 as Base64String
        )
    } else {
        await saveGrapherConfigToR2(
            fullConfigMd5.full,
            r2Path.directory,
            r2Path.filename,
            fullConfigMd5.fullMd5 as Base64String
        )
    }

    return {
        chartConfigId,
        fullConfig: fullConfigMd5.full,
        fullConfigMd5: fullConfigMd5.fullMd5,
    }
}

export const updateChartConfigInDbAndR2 = async (
    knex: db.KnexReadWriteTransaction,
    chartConfigId: Base64String,
    patchConfig: GrapherInterface,
    fullConfig: GrapherInterface
) => {
    await knex<DbInsertChartConfig>(ChartConfigsTableName)
        .update({
            patch: serializeChartConfig(patchConfig),
            full: serializeChartConfig(fullConfig),
            updatedAt: new Date(), // It's not updated automatically in the DB.
        })
        .where({ id: chartConfigId })

    return retrieveChartConfigFromDbAndSaveToR2(knex, chartConfigId)
}

export const saveNewChartConfigInDbAndR2 = async (
    knex: db.KnexReadWriteTransaction,
    chartConfigId: Base64String | undefined,
    patchConfig: GrapherInterface,
    fullConfig: GrapherInterface
) => {
    chartConfigId ??= uuidv7() as Base64String

    await knex<DbInsertChartConfig>(ChartConfigsTableName).insert({
        id: chartConfigId,
        patch: serializeChartConfig(patchConfig),
        full: serializeChartConfig(fullConfig),
    })

    return retrieveChartConfigFromDbAndSaveToR2(knex, chartConfigId)
}
