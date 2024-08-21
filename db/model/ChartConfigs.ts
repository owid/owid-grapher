import { DbInsertChartConfig, GrapherInterface } from "@ourworldindata/types"

import * as db from "../db.js"

interface ConfigWithId {
    configId: DbInsertChartConfig["id"]
    config: GrapherInterface
}

export async function updateExistingConfigPair(
    knex: db.KnexReadWriteTransaction,
    {
        configId,
        patchConfig,
        fullConfig,
    }: {
        configId: DbInsertChartConfig["id"]
        patchConfig: GrapherInterface
        fullConfig: GrapherInterface
    }
): Promise<void> {
    await db.knexRaw(
        knex,
        `-- sql
            UPDATE chart_configs
            SET
                patch = ?,
                full = ?
            WHERE id = ?
        `,
        [JSON.stringify(patchConfig), JSON.stringify(fullConfig), configId]
    )
}

export async function updateExistingPatchConfig(
    knex: db.KnexReadWriteTransaction,
    params: ConfigWithId
): Promise<void> {
    await updateExistingConfig(knex, { ...params, column: "patch" })
}

export async function updateExistingFullConfig(
    knex: db.KnexReadWriteTransaction,
    params: ConfigWithId
): Promise<void> {
    await updateExistingConfig(knex, { ...params, column: "full" })
}

async function updateExistingConfig(
    knex: db.KnexReadWriteTransaction,
    {
        column,
        configId,
        config,
    }: ConfigWithId & {
        column: "patch" | "full"
    }
): Promise<void> {
    await db.knexRaw(
        knex,
        `-- sql
            UPDATE chart_configs
            SET ?? = ?
            WHERE id = ?
        `,
        [column, JSON.stringify(config), configId]
    )
}
