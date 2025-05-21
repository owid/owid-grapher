import {
    NarrativeChartInfo,
    NarrativeChartsTableName,
    DbPlainNarrativeChart,
    JsonString,
} from "@ourworldindata/types"
import * as db from "../db.js"

export async function narrativeChartExists(
    knex: db.KnexReadonlyTransaction,
    data: Partial<DbPlainNarrativeChart>
): Promise<boolean> {
    const result = await knex(NarrativeChartsTableName)
        .select(knex.raw("1"))
        .where(data)
        .first()
    return Boolean(result)
}

export const getNarrativeChartsInfo = async (
    knex: db.KnexReadonlyTransaction,
    names?: string[]
): Promise<NarrativeChartInfo[]> => {
    if (names?.length === 0) return []

    type RawRow = Omit<NarrativeChartInfo, "queryParamsForParentChart"> & {
        queryParamsForParentChart: JsonString
    }

    const rows: RawRow[] = await knex("narrative_charts as nc")
        .select(
            "nc.name",
            knex.raw('cc.full ->> "$.title" as title'),
            "nc.chartConfigId",
            knex.raw("COALESCE(pcc.slug, mddp.slug) as parentChartSlug"),
            "nc.queryParamsForParentChart"
        )
        .join("chart_configs as cc", "cc.id", "nc.chartConfigId")
        .leftJoin("charts as pc", "nc.parentChartId", "pc.id")
        .leftJoin("chart_configs as pcc", "pc.configId", "pcc.id")
        .leftJoin(
            "multi_dim_x_chart_configs as mdxcc",
            "nc.parentMultiDimXChartConfigId",
            "mdxcc.id"
        )
        .leftJoin("multi_dim_data_pages as mddp", "mdxcc.multiDimId", "mddp.id")
        .modify((queryBuilder) => {
            if (names?.length) {
                queryBuilder.whereIn("nc.name", names)
            }
        })

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
