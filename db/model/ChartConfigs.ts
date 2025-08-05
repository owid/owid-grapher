import {
    ChartConfigsTableName,
    DbEnrichedChartConfig,
    DbInsertChartConfig,
    DbRawChartConfig,
    GrapherInterface,
    parseChartConfigsRow,
    serializeChartConfig,
} from "@ourworldindata/types"

import * as db from "../db.js"

export async function getChartConfigById(
    knex: db.KnexReadonlyTransaction,
    id: string
): Promise<DbEnrichedChartConfig | undefined> {
    const chartConfig = await knex<DbRawChartConfig>(ChartConfigsTableName)
        .where("id", id)
        .first()
    return chartConfig ? parseChartConfigsRow(chartConfig) : undefined
}

export async function insertChartConfig(
    knex: db.KnexReadWriteTransaction,
    config: DbInsertChartConfig
): Promise<string> {
    await knex(ChartConfigsTableName).insert(config)
    return config.id
}

export async function updateExistingConfigPair(
    knex: db.KnexReadWriteTransaction,
    {
        configId,
        patchConfig,
        fullConfig,
        updatedAt,
    }: {
        configId: DbInsertChartConfig["id"]
        patchConfig: GrapherInterface
        fullConfig: GrapherInterface
        updatedAt: Date
    }
): Promise<void> {
    await db.knexRaw(
        knex,
        `-- sql
            UPDATE chart_configs
            SET
                patch = ?,
                full = ?,
                updatedAt = ?
            WHERE id = ?
        `,
        [
            serializeChartConfig(patchConfig),
            serializeChartConfig(fullConfig),
            updatedAt,
            configId,
        ]
    )
}

type ConfigId = DbInsertChartConfig["id"]
interface UpdateFields {
    config: GrapherInterface
    updatedAt: Date
}

export async function updateExistingPatchConfig(
    knex: db.KnexReadWriteTransaction,
    params: UpdateFields & { configId: ConfigId }
): Promise<void> {
    await updateExistingConfig(knex, { ...params, column: "patch" })
}

export async function updateExistingFullConfig(
    knex: db.KnexReadWriteTransaction,
    params: UpdateFields & { configId: ConfigId }
): Promise<void> {
    await updateExistingConfig(knex, { ...params, column: "full" })
}

async function updateExistingConfig(
    knex: db.KnexReadWriteTransaction,
    {
        column,
        configId,
        config,
        updatedAt,
    }: UpdateFields & {
        configId: ConfigId
        column: "patch" | "full"
    }
): Promise<void> {
    await db.knexRaw(
        knex,
        `-- sql
            UPDATE chart_configs
            SET
                ?? = ?,
                updatedAt = ?
            WHERE id = ?
        `,
        [column, serializeChartConfig(config), updatedAt, configId]
    )
}
