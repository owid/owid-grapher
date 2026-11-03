import * as _ from "lodash-es"
import {
    NarrativeChartInfo,
    NarrativeChartsTableName,
    DbPlainNarrativeChart,
    JsonString,
    ArchivedPageVersion,
    ContentGraphLinkType,
} from "@ourworldindata/types"
import * as db from "../db.js"
import { getPublishedLinksTo } from "./Link.js"
import { getLatestArchivedChartPageVersionsIfEnabled } from "./ArchivedChartVersion.js"
import { getLatestArchivedMultiDimPageVersionsIfEnabled } from "./ArchivedMultiDimVersion.js"
import { ARCHIVE_BASE_URL } from "../../settings/serverSettings.js"

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

/**
 * Maps the name of each given narrative chart that is used in published content
 * to the slugs of the published gdocs that use it.
 */
export async function getPublishedSlugsByNarrativeChartName(
    knex: db.KnexReadonlyTransaction,
    names: string[]
): Promise<Map<string, string[]>> {
    if (!names.length) return new Map()
    const links = await getPublishedLinksTo(
        knex,
        names,
        ContentGraphLinkType.NarrativeChart
    )
    return new Map(
        Object.entries(_.groupBy(links, (link) => link.target)).map(
            ([name, links]) => [name, _.uniq(links.map((link) => link.slug))]
        )
    )
}

export const getNarrativeChartsInfo = async (
    knex: db.KnexReadonlyTransaction,
    names?: string[]
): Promise<NarrativeChartInfo[]> => {
    if (names?.length === 0) return []

    const includeParentArchive = !!ARCHIVE_BASE_URL

    type RawRow = Omit<
        NarrativeChartInfo,
        "queryParamsForParentChart" | "latestArchivedParent"
    > & {
        queryParamsForParentChart: JsonString
        parentChartId: number | null
        parentMultiDimId: number | null
    }

    const rows: RawRow[] = await knex("narrative_charts as nc")
        .select(
            "nc.name",
            knex.raw('cc.config ->> "$.title" as title'),
            "nc.chartConfigId",
            knex.raw("COALESCE(pcc.slug, mddp.slug) as parentChartSlug"),
            "nc.queryParamsForParentChart",
            "nc.parentChartId",
            knex.raw("mddp.id as parentMultiDimId")
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

    let archivedChartVersions: Record<number, ArchivedPageVersion> = {}
    let archivedMultiDimVersions: Record<number, ArchivedPageVersion> = {}

    if (includeParentArchive) {
        const parentChartIds = _.uniq(
            rows
                .map((row) => row.parentChartId ?? undefined)
                .filter((id): id is number => id !== undefined)
        )
        const parentMultiDimIds = _.uniq(
            rows
                .map((row) => row.parentMultiDimId ?? undefined)
                .filter((id): id is number => id !== undefined)
        )

        if (parentChartIds.length) {
            archivedChartVersions =
                await getLatestArchivedChartPageVersionsIfEnabled(
                    knex,
                    parentChartIds
                )
        }

        if (parentMultiDimIds.length) {
            archivedMultiDimVersions =
                await getLatestArchivedMultiDimPageVersionsIfEnabled(
                    knex,
                    parentMultiDimIds
                )
        }
    }

    return rows.map((row) => ({
        name: row.name,
        title: row.title,
        chartConfigId: row.chartConfigId,
        parentChartSlug: row.parentChartSlug,
        queryParamsForParentChart: JSON.parse(row.queryParamsForParentChart),
        latestArchivedParent: includeParentArchive
            ? row.parentChartId
                ? archivedChartVersions[row.parentChartId]
                : row.parentMultiDimId
                  ? archivedMultiDimVersions[row.parentMultiDimId]
                  : undefined
            : undefined,
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
    return db.cachedInTransaction(knex, "narrativeChartNames", async () => {
        const rows = await knex<DbPlainNarrativeChart>(
            NarrativeChartsTableName
        ).select("name")
        return new Set(rows.map((row) => row.name))
    })
}
