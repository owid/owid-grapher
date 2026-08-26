import {
    ChartConfigsTableName,
    DbInsertChartConfig,
    DbRawChartConfig,
    GrapherInterface,
    parseChartConfig,
    serializeChartConfig,
} from "@ourworldindata/types"

import { v7 as uuidv7 } from "uuid"

import * as db from "../db.js"

export async function getChartConfigByUuid(
    knex: db.KnexReadonlyTransaction,
    id: string
): Promise<GrapherInterface | undefined> {
    const row = await db.knexRawFirst<Pick<DbRawChartConfig, "config">>(
        knex,
        `SELECT config FROM chart_configs WHERE id = ?`,
        [id]
    )
    return row ? parseChartConfig(row.config) : undefined
}

/** Returns the id of the new row, which it mints. */
export async function insertChartConfig(
    knex: db.KnexReadWriteTransaction,
    {
        config,
        createdAt,
        updatedAt,
    }: {
        config: GrapherInterface
        createdAt?: Date
        updatedAt?: Date
    }
): Promise<string> {
    const id = uuidv7()
    await knex<DbInsertChartConfig>(ChartConfigsTableName).insert({
        id,
        config: serializeChartConfig(config),
        createdAt,
        updatedAt,
    })
    return id
}

export async function updateChartConfig(
    knex: db.KnexReadWriteTransaction,
    {
        configId,
        config,
        updatedAt,
    }: {
        configId: DbInsertChartConfig["id"]
        config: GrapherInterface
        updatedAt: Date
    }
): Promise<void> {
    await db.knexRaw(
        knex,
        `-- sql
            UPDATE chart_configs
            SET
                config = ?,
                updatedAt = ?
            WHERE id = ?
        `,
        [serializeChartConfig(config), updatedAt, configId]
    )
}
export async function getChartConfigsByUuids(
    knex: db.KnexReadonlyTransaction,
    uuids: string[]
): Promise<Map<string, GrapherInterface>> {
    if (uuids.length === 0) return new Map()
    const rows = await knex<DbRawChartConfig>(ChartConfigsTableName)
        .select("id", "config")
        .whereIn("id", uuids)
    return new Map(rows.map((row) => [row.id, parseChartConfig(row.config)]))
}
