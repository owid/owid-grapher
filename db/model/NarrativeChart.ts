import {
    NarrativeChartInfo,
    NarrativeChartsTableName,
    DbPlainNarrativeChart,
    JsonString,
} from "@ourworldindata/types"
import * as db from "../db.js"

export const getNarrativeChartsInfo = async (
    knex: db.KnexReadonlyTransaction,
    names?: string[]
): Promise<NarrativeChartInfo[]> => {
    type RawRow = Omit<NarrativeChartInfo, "queryParamsForParentChart"> & {
        queryParamsForParentChart: JsonString
    }
    let rows: RawRow[]

    const query = `-- sql
SELECT nc.name,
       cc.full ->> "$.title" as title,
       nc.chartConfigId,
       pcc.slug as parentChartSlug,
       nc.queryParamsForParentChart
FROM narrative_charts nc
JOIN chart_configs cc on cc.id = nc.chartConfigId
JOIN charts pc on nc.parentChartId = pc.id
JOIN chart_configs pcc on pc.configId = pcc.id
        `

    if (names) {
        if (names.length === 0) return []
        rows = await db.knexRaw(knex, `${query} WHERE nc.name IN (?)`, [names])
    } else rows = await db.knexRaw(knex, query)

    return rows.map((row) => ({
        ...row,
        queryParamsForParentChart: JSON.parse(row.queryParamsForParentChart),
    }))
}

export const getNarrativeChartNameConfigMap = async (
    knex: db.KnexReadonlyTransaction
): Promise<
    Record<
        DbPlainNarrativeChart["name"],
        DbPlainNarrativeChart["chartConfigId"]
    >
> => {
    const rows = await db.knexRaw<
        Pick<DbPlainNarrativeChart, "name" | "chartConfigId">
    >(knex, `SELECT name, chartConfigId FROM narrative_charts`)
    return Object.fromEntries(rows.map((row) => [row.name, row.chartConfigId]))
}

export const getAllNarrativeChartNames = async (
    knex: db.KnexReadonlyTransaction
): Promise<Set<string>> => {
    const rows = await knex<DbPlainNarrativeChart>(
        NarrativeChartsTableName
    ).select("name")
    return new Set(rows.map((row) => row.name))
}
