import { Json } from "@ourworldindata/utils"
import * as db from "../db/db.js"

export async function getLogsByChartId(
    knex: db.KnexReadonlyTransaction,
    chartId: number
): Promise<
    {
        userId: number
        config: Json
        userName: string
        createdAt: Date
    }[]
> {
    const logs = await db.knexRaw<{
        userId: number
        config: string
        userName: string
        createdAt: Date
    }>(
        knex,
        `SELECT userId, config, fullName as userName, l.createdAt
        FROM chart_revisions l
        LEFT JOIN users u on u.id = userId
        WHERE chartId = ?
        ORDER BY l.id DESC
        LIMIT 50`,
        [chartId]
    )
    return logs.map((log) => ({
        ...log,
        config: JSON.parse(log.config),
    }))
}
