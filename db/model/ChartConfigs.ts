import {
    ChartConfigsTableName,
    DbInsertChartConfig,
    DbRawChartConfig,
    GrapherInterface,
    JsonString,
} from "@ourworldindata/types"
import { migrateGrapherConfigToLatestVersion } from "@ourworldindata/grapher"

import { v7 as uuidv7 } from "uuid"

import * as db from "../db.js"

/** Parses a stored chart config, migrating it to the latest schema version unless `skipMigration` */
export function parseChartConfig(
    config: JsonString,
    { skipMigration }: { skipMigration?: boolean } = {}
): GrapherInterface {
    const parsed = JSON.parse(config)
    if (skipMigration) return parsed

    try {
        return migrateGrapherConfigToLatestVersion(parsed)
    } catch {
        return parsed
    }
}

export function serializeChartConfig(config: GrapherInterface): JsonString {
    return JSON.stringify(config)
}

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

/** Returns the id of the new row, which it mints unless the caller supplies one. */
export async function insertChartConfig(
    knex: db.KnexReadWriteTransaction,
    {
        id: providedId,
        config,
        createdAt,
        updatedAt,
    }: {
        id?: string
        config: GrapherInterface
        createdAt?: Date
        updatedAt?: Date
    }
): Promise<string> {
    const id = providedId ?? uuidv7()
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
