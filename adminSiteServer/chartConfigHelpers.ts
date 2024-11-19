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

    if (!r2Path) {
        await saveGrapherConfigToR2ByUUID(
            chartConfigId,
            fullConfigMd5!.full,
            fullConfigMd5!.fullMd5 as Base64String
        )
    } else {
        await saveGrapherConfigToR2(
            fullConfigMd5!.full,
            r2Path.directory,
            r2Path.filename,
            fullConfigMd5!.fullMd5 as Base64String
        )
    }

    return {
        chartConfigId,
        fullConfig: fullConfigMd5!.full,
        fullConfigMd5: fullConfigMd5!.fullMd5,
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
    chartConfigId = chartConfigId ?? (uuidv7() as Base64String)

    await knex<DbInsertChartConfig>(ChartConfigsTableName).insert({
        id: chartConfigId,
        patch: serializeChartConfig(patchConfig),
        full: serializeChartConfig(fullConfig),
    })

    return retrieveChartConfigFromDbAndSaveToR2(knex, chartConfigId)
}
