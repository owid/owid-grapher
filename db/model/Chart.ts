import * as lodash from "lodash-es"
import * as db from "../db.js"
import {
    getDataForMultipleVariables,
    getGrapherConfigsForVariable,
} from "./Variable.js"
import {
    JsonError,
    KeyChartLevel,
    MultipleOwidVariableDataDimensionsMap,
    DbChartTagJoin,
    getParentVariableIdFromChartConfig,
} from "@ourworldindata/utils"
import {
    GrapherInterface,
    RelatedChart,
    DbPlainChart,
    parseChartConfig,
    ChartRedirect,
    DbPlainTag,
    DbRawChartConfig,
    DbEnrichedChartConfig,
    GrapherChartType,
} from "@ourworldindata/types"
import { OpenAI } from "openai"
import { zodResponseFormat } from "openai/helpers/zod"
import { OPENAI_API_KEY } from "../../settings/serverSettings.js"
import { z } from "zod/v3"

// XXX hardcoded filtering to public parent tags
export const PUBLIC_TAG_PARENT_IDS = [
    1515, 1507, 1513, 1504, 1502, 1509, 1506, 1501, 1514, 1511, 1500, 1503,
    1505, 1508, 1512, 1510, 1834, 1835,
]

// Only considers published charts, because only in that case the mapping slug -> id is unique
export async function mapSlugsToIds(
    knex: db.KnexReadonlyTransaction
): Promise<{ [slug: string]: number }> {
    const [redirects, rows] = await Promise.all([
        db.knexRaw<{ chart_id: number; slug: string }>(
            knex,
            `SELECT chart_id, slug FROM chart_slug_redirects`
        ),
        db.knexRaw<{ id: number; slug: string }>(
            knex,
            `-- sql
                SELECT c.id, cc.slug
                FROM charts c
                JOIN chart_configs cc ON cc.id = c.configId
                WHERE cc.full ->> "$.isPublished" = "true"
            `
        ),
    ])

    const slugToId: { [slug: string]: number } = {}
    for (const row of redirects) {
        slugToId[row.slug] = row.chart_id
    }
    for (const row of rows) {
        slugToId[row.slug] = row.id
    }
    return slugToId
}

// Same as mapSlugsToIds but gets the configs also
// e.g. [
//  { slug: 'old-slug', id: 101, config: { isPublished: true, ...} },
//  { slug: 'new-slug', id: 101, config: { isPublished: true, ...} },
// ]
export async function mapSlugsToConfigs(
    knex: db.KnexReadonlyTransaction
): Promise<{ slug: string; id: number; config: GrapherInterface }[]> {
    return db
        .knexRaw<{ slug: string; config: string; id: number }>(
            knex,
            `-- sql
                SELECT csr.slug AS slug, cc.full AS config, c.id AS id
                FROM chart_slug_redirects csr
                JOIN charts c ON csr.chart_id = c.id
                JOIN chart_configs cc ON cc.id = c.configId
                WHERE cc.full ->> "$.isPublished" = "true"
                UNION
                SELECT cc.slug, cc.full AS config, c.id AS id
                FROM charts c
                JOIN chart_configs cc ON cc.id = c.configId
                WHERE cc.full ->> "$.isPublished" = "true"
            `
        )
        .then((results) =>
            results.map((result) => ({
                ...result,
                config: JSON.parse(result.config),
            }))
        )
}

export async function getEnrichedChartBySlug(
    knex: db.KnexReadonlyTransaction,
    slug: string
): Promise<(DbPlainChart & { config: DbEnrichedChartConfig["full"] }) | null> {
    let chart = await db.knexRawFirst<
        DbPlainChart & { config: DbRawChartConfig["full"] }
    >(
        knex,
        `-- sql
            SELECT c.*, cc.full as config
            FROM charts c
            JOIN chart_configs cc ON c.configId = cc.id
            WHERE cc.slug = ?
        `,
        [slug]
    )

    if (!chart) {
        chart = await db.knexRawFirst<
            DbPlainChart & { config: DbRawChartConfig["full"] }
        >(
            knex,
            `-- sql
                SELECT
                    c.*, cc.full as config
                FROM
                    chart_slug_redirects csr
                    JOIN charts c ON csr.chart_id = c.id
                    JOIN chart_configs cc ON c.configId = cc.id
                WHERE
                    csr.slug = ?
            `,
            [slug]
        )
    }

    if (!chart) return null

    const enrichedChart = { ...chart, config: parseChartConfig(chart.config) }

    return enrichedChart
}

export async function getRawChartById(
    knex: db.KnexReadonlyTransaction,
    id: number
): Promise<(DbPlainChart & { config: DbRawChartConfig["full"] }) | null> {
    const chart = await db.knexRawFirst<
        DbPlainChart & { config: DbRawChartConfig["full"] }
    >(
        knex,
        `-- sql
            SELECT c.*, cc.full AS config
            FROM charts c
            JOIN chart_configs cc ON c.configId = cc.id
            WHERE id = ?
        `,
        [id]
    )
    if (!chart) return null
    return chart
}

export async function getRawChartsByIds(
    knex: db.KnexReadonlyTransaction,
    ids: number[]
): Promise<(DbPlainChart & { config: DbRawChartConfig["full"] })[]> {
    const charts = await db.knexRaw<
        DbPlainChart & { config: DbRawChartConfig["full"] }
    >(
        knex,
        `-- sql
            SELECT c.*, cc.full AS config
            FROM charts c
            JOIN chart_configs cc ON c.configId = cc.id
            WHERE c.id IN (?)
        `,
        [ids]
    )
    return charts
}

export async function getPatchConfigByChartId(
    knex: db.KnexReadonlyTransaction,
    id: number
): Promise<GrapherInterface | undefined> {
    const chart = await db.knexRawFirst<Pick<DbRawChartConfig, "patch">>(
        knex,
        `-- sql
            SELECT patch
            FROM chart_configs cc
            JOIN charts c ON c.configId = cc.id
            WHERE c.id = ?
        `,
        [id]
    )
    if (!chart) return undefined
    return parseChartConfig(chart.patch)
}

export async function getEnrichedChartById(
    knex: db.KnexReadonlyTransaction,
    id: number
): Promise<(DbPlainChart & { config: DbEnrichedChartConfig["full"] }) | null> {
    const rawChart = await getRawChartById(knex, id)
    if (!rawChart) return null
    return { ...rawChart, config: parseChartConfig(rawChart.config) }
}

export async function getEnrichedChartsByIds(
    knex: db.KnexReadonlyTransaction,
    ids: number[]
): Promise<(DbPlainChart & { config: DbEnrichedChartConfig["full"] })[]> {
    const charts = await getRawChartsByIds(knex, ids)
    return charts.map((rawChart) => ({
        ...rawChart,
        config: parseChartConfig(rawChart.config),
    }))
}

export async function getChartSlugById(
    knex: db.KnexReadonlyTransaction,
    id: number
): Promise<string | null> {
    const chart = await db.knexRawFirst<{ slug: string }>(
        knex,
        `-- sql
            SELECT slug
            FROM chart_configs cc
            JOIN charts c ON c.configId = cc.id
            WHERE c.id = ?
        `,
        [id]
    )
    if (!chart) return null
    return chart.slug
}

export const getChartConfigById = async (
    knex: db.KnexReadonlyTransaction,
    grapherId: number
): Promise<
    | (Pick<DbPlainChart, "id"> & { config: DbEnrichedChartConfig["full"] })
    | undefined
> => {
    const grapher = await db.knexRawFirst<
        Pick<DbPlainChart, "id"> & { config: DbRawChartConfig["full"] }
    >(
        knex,
        `-- sql
            SELECT c.id, cc.full as config
            FROM charts c
            JOIN chart_configs cc ON c.configId = cc.id
            WHERE c.id=?
        `,
        [grapherId]
    )

    if (!grapher) return undefined

    return {
        id: grapher.id,
        config: parseChartConfig(grapher.config),
    }
}

export async function getChartConfigBySlug(
    knex: db.KnexReadonlyTransaction,
    slug: string
): Promise<
    Pick<DbPlainChart, "id"> & { config: DbEnrichedChartConfig["full"] }
> {
    const row = await db.knexRawFirst<
        Pick<DbPlainChart, "id"> & { config: DbRawChartConfig["full"] }
    >(
        knex,
        `-- sql
            SELECT c.id, cc.full as config
            FROM charts c
            JOIN chart_configs cc ON c.configId = cc.id
            WHERE cc.slug = ?`,
        [slug]
    )

    if (!row) throw new JsonError(`No chart found for slug ${slug}`, 404)

    return { id: row.id, config: parseChartConfig(row.config) }
}

export async function isInheritanceEnabledForChart(
    trx: db.KnexReadonlyTransaction,
    chartId: number
): Promise<boolean> {
    const row = await db.knexRawFirst<
        Pick<DbPlainChart, "isInheritanceEnabled">
    >(
        trx,
        `-- sql
            SELECT isInheritanceEnabled
            FROM charts
            WHERE id = ?
        `,
        [chartId]
    )
    return row?.isInheritanceEnabled ?? false
}

async function getParentVariableIdByChartId(
    trx: db.KnexReadonlyTransaction,
    chartId: number
): Promise<number | undefined> {
    const parent = await db.knexRawFirst<{ variableId: number | undefined }>(
        trx,
        `-- sql
            SELECT variableId
            FROM charts_x_parents
            WHERE chartId = ?
        `,
        [chartId]
    )
    return parent?.variableId
}

export async function getParentByChartId(
    trx: db.KnexReadonlyTransaction,
    chartId: number
): Promise<{ variableId?: number; config?: GrapherInterface }> {
    const parentVariableId = await getParentVariableIdByChartId(trx, chartId)
    if (!parentVariableId) return {}
    const variable = await getGrapherConfigsForVariable(trx, parentVariableId)
    const parentConfig =
        variable?.admin?.fullConfig ?? variable?.etl?.fullConfig
    return {
        variableId: parentVariableId,
        config: parentConfig,
    }
}

export async function getParentByChartConfig(
    trx: db.KnexReadonlyTransaction,
    config: GrapherInterface
): Promise<{
    variableId?: number
    config?: GrapherInterface
}> {
    const parentVariableId = getParentVariableIdFromChartConfig(config)
    if (!parentVariableId) return {}
    const variable = await getGrapherConfigsForVariable(trx, parentVariableId)
    const parentConfig =
        variable?.admin?.fullConfig ?? variable?.etl?.fullConfig
    return {
        variableId: parentVariableId,
        config: parentConfig,
    }
}

export async function setChartTags(
    knex: db.KnexReadWriteTransaction,
    chartId: number,
    tags: DbChartTagJoin[],
    userId?: number
): Promise<void> {
    const tagRows = tags.map((tag) => [
        tag.id,
        chartId,
        tag.keyChartLevel ?? KeyChartLevel.None,
        tag.isApproved ? 1 : 0,
    ])
    await db.knexRaw(knex, `DELETE FROM chart_tags WHERE chartId=?`, [chartId])
    if (tagRows.length)
        await db.knexRaw(
            knex,
            `INSERT INTO chart_tags (tagId, chartId, keyChartLevel, isApproved) VALUES ?`,
            [tagRows]
        )

    const parentIds = tags.length
        ? await db.knexRaw<{ parentId: number }>(
              knex,
              `-- sql
                SELECT
                    parentId
                FROM
                    tags
                WHERE
                    id IN (?)`,
              [tags.map((t) => t.id)]
          )
        : []

    // A chart is indexable if it is not tagged "Unlisted" and has at
    // least one public parent tag
    const isIndexable = tags.some((t) => t.name === "Unlisted")
        ? false
        : parentIds.some((t) => PUBLIC_TAG_PARENT_IDS.includes(t.parentId))
    const updateFields = ["isIndexable = ?", "lastEditedAt = ?"]
    const updateValues: (boolean | Date | number)[] = [isIndexable, new Date()]

    if (userId) {
        updateFields.push("lastEditedByUserId = ?")
        updateValues.push(userId)
    }

    await db.knexRaw(
        knex,
        `update charts set ${updateFields.join(", ")} where id = ?`,
        [...updateValues, chartId]
    )
}

export async function assignTagsForCharts(
    knex: db.KnexReadonlyTransaction,
    charts: {
        id: number
        tags?: DbChartTagJoin[]
    }[]
): Promise<void> {
    const chartTags = await db.knexRaw<{
        chartId: number
        tagId: number
        keyChartLevel: number
        isApproved: number | undefined
        tagName: string
    }>(
        knex,
        `-- sql
            SELECT ct.chartId, ct.tagId, ct.keyChartLevel, ct.isApproved, t.name as tagName
            FROM chart_tags ct
            JOIN charts c ON c.id=ct.chartId
            JOIN tags t ON t.id=ct.tagId
        `
    )

    for (const chart of charts) {
        chart.tags = []
    }

    const chartsById = lodash.keyBy(charts, (c) => c.id)

    for (const ct of chartTags) {
        const chart = chartsById[ct.chartId]
        if (chart)
            chart.tags!.push({
                id: ct.tagId,
                name: ct.tagName,
                keyChartLevel: ct.keyChartLevel,
                isApproved: !!ct.isApproved,
            })
    }
}

export async function getGptTopicSuggestions(
    knex: db.KnexReadonlyTransaction,
    chartId: number
): Promise<Pick<DbPlainTag, "id" | "name">[]> {
    if (!OPENAI_API_KEY) throw new JsonError("No OPENAI_API_KEY env found", 500)

    const chartConfigOnly = await db.knexRawFirst<{ config: string }>(
        knex,
        `-- sql
            SELECT cc.full as config
            FROM chart_configs cc
            JOIN charts c ON c.configId = cc.id
            WHERE c.id = ?
        `,
        [chartId]
    )
    if (!chartConfigOnly)
        throw new JsonError(`No chart found for id ${chartId}`, 404)
    const enrichedChartConfig = parseChartConfig(chartConfigOnly.config)

    const topics: Pick<DbPlainTag, "id" | "name">[] = await db.knexRaw(
        knex,
        `-- sql
        SELECT t.id, t.name
            FROM tags t
            WHERE t.slug IS NOT NULL
            AND t.parentId IN (${PUBLIC_TAG_PARENT_IDS.join(",")})
        `
    )

    if (!topics.length) throw new JsonError("No topics found", 404)

    // Define Zod schema for the response
    const TopicSchema = z.object({
        id: z.number(),
        name: z.string(),
    })
    const TopicsResponseSchema = z.object({
        topics: z.array(TopicSchema),
    })

    const prompt = `
            You will be provided with the chart metadata (delimited with XML tags),
            as well as a list of possible topics (delimited with XML tags).
            Classify the chart into one or two of the provided topics.
            <chart>
                <title>${enrichedChartConfig.title}</title>
                <description>${enrichedChartConfig.subtitle}</description>
                <listed-on>${enrichedChartConfig.originUrl}</listed-on>
            </chart>
            <topics>
                ${topics
                    .map(
                        (topic) => `<topic id=${topic.id}>${topic.name}</topic>`
                    )
                    .join("\n")}
            </topics>

            Select the one or two categories you think best describe the chart.`

    const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
    })
    const completion = await openai.chat.completions.parse({
        messages: [{ role: "user", content: prompt }],
        model: "gpt-5-mini",
        response_format: zodResponseFormat(TopicsResponseSchema, "topics"),
    })

    const parsedResponse = completion.choices[0].message.parsed
    if (!parsedResponse?.topics?.length)
        throw new JsonError("No response from GPT", 500)

    // We only want to return topics that are in the list of possible topics
    const confirmedTopics = topics.filter((topic) =>
        parsedResponse.topics.some(
            (t) => t.id === topic.id && t.name === topic.name
        )
    )

    return confirmedTopics
}

export interface OldChartFieldList {
    id: number
    title: string
    slug: string
    type?: string
    internalNotes: string
    variantName: string
    isPublished: boolean
    tab: string
    hasChartTab: boolean
    hasMapTab: boolean
    lastEditedAt: Date
    lastEditedByUserId: number
    lastEditedBy: string
    publishedAt: Date
    publishedByUserId: number
    publishedBy: string
    isExplorable: boolean
}

export const oldChartFieldList = `
        charts.id,
        chart_configs.full->>"$.title" AS title,
        chart_configs.full->>"$.slug" AS slug,
        chart_configs.chartType AS type,
        chart_configs.full->>"$.internalNotes" AS internalNotes,
        chart_configs.full->>"$.variantName" AS variantName,
        chart_configs.full->>"$.tab" AS tab,
        chart_configs.chartType IS NOT NULL AS hasChartTab,
        JSON_EXTRACT(chart_configs.full, "$.hasMapTab") = true AS hasMapTab,
        JSON_EXTRACT(chart_configs.full, "$.isPublished") = true AS isPublished,
        charts.lastEditedAt,
        charts.lastEditedByUserId,
        lastEditedByUser.fullName AS lastEditedBy,
        charts.publishedAt,
        charts.publishedByUserId,
        publishedByUser.fullName AS publishedBy
    `
// TODO: replace this with getBySlug and pick

export async function getChartVariableData(
    config: GrapherInterface
): Promise<MultipleOwidVariableDataDimensionsMap> {
    const variableIds = lodash.uniq(
        config.dimensions!.map((d: any) => d.variableId)
    )
    const allVariablesDataAndMetadataMap = await getDataForMultipleVariables(
        variableIds as number[]
    )
    return allVariablesDataAndMetadataMap
}

export const getMostViewedGrapherIdsByChartType = async (
    knex: db.KnexReadonlyTransaction,
    chartType: GrapherChartType,
    count = 10
): Promise<number[]> => {
    const ids = await db.knexRaw<{ id: number }>(
        knex,
        `-- sql
            SELECT c.id
            FROM analytics_pageviews a
            JOIN chart_configs cc ON slug = SUBSTRING_INDEX(a.url, '/', -1)
            JOIN charts c ON c.configId = cc.id
            WHERE a.url LIKE "https://ourworldindata.org/grapher/%"
                AND cc.chartType = ?
                AND cc.full ->> "$.isPublished" = "true"
            ORDER BY a.views_365d DESC
            LIMIT ?
        `,
        [chartType, count]
    )
    return ids.map((row) => row.id)
}

export const getRelatedChartsForVariable = async (
    knex: db.KnexReadonlyTransaction,
    variableId: number,
    chartIdsToExclude: number[] = []
): Promise<RelatedChart[]> => {
    const excludeChartIds =
        chartIdsToExclude.length > 0
            ? `AND charts.id NOT IN (${chartIdsToExclude.join(", ")})`
            : ""

    return db.knexRaw<RelatedChart>(
        knex,
        `-- sql
            SELECT
                charts.id AS chartId,
                chart_configs.slug,
                chart_configs.full->>"$.title" AS title,
                chart_configs.full->>"$.variantName" AS variantName,
                MAX(chart_tags.keyChartLevel) as keyChartLevel
            FROM charts
            JOIN chart_configs ON charts.configId=chart_configs.id
            INNER JOIN chart_tags ON charts.id=chart_tags.chartId
            INNER JOIN chart_dimensions ON charts.id=chart_dimensions.chartId
            WHERE chart_dimensions.variableId = ${variableId}
            AND chart_configs.full->>"$.isPublished" = "true"
            ${excludeChartIds}
            GROUP BY charts.id
            ORDER BY title ASC
        `
    )
}

export const getRedirectsByChartId = async (
    knex: db.KnexReadonlyTransaction,
    chartId: number
): Promise<ChartRedirect[]> =>
    await db.knexRaw(
        knex,
        `-- sql
        SELECT id, slug, chart_id as chartId
        FROM chart_slug_redirects
        WHERE chart_id = ?
        ORDER BY id ASC`,
        [chartId]
    )

export async function getAllPublishedChartSlugs(
    knex: db.KnexReadonlyTransaction
): Promise<string[]> {
    const rows = await db.knexRaw<{
        slug: string
    }>(
        knex,
        `-- sql
            SELECT cc.slug
            FROM charts c
            JOIN chart_configs cc ON c.configId = cc.id
            WHERE cc.full->>"$.isPublished" = "true"
        `
    )
    return rows.map((row) => row.slug)
}
