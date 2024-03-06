// import {
//     Entity,
//     PrimaryGeneratedColumn,
//     Column,
//     BaseEntity,
//     ManyToOne,
//     OneToMany,
//     type Relation,
// } from "typeorm"
import * as lodash from "lodash"
import * as db from "../db.js"
import { getDataForMultipleVariables } from "./Variable.js"
// import { User } from "./User.js"
// import { ChartRevision } from "./ChartRevision.js"
import {
    JsonError,
    KeyChartLevel,
    MultipleOwidVariableDataDimensionsMap,
    DbChartTagJoin,
} from "@ourworldindata/utils"
import {
    GrapherInterface,
    ChartTypeName,
    RelatedChart,
    DbPlainPostLink,
    DbRawChart,
    DbEnrichedChart,
    parseChartsRow,
    parseChartConfig,
    ChartRedirect,
    DbPlainTag,
} from "@ourworldindata/types"
import { OpenAI } from "openai"
import {
    BAKED_BASE_URL,
    OPENAI_API_KEY,
} from "../../settings/serverSettings.js"

// XXX hardcoded filtering to public parent tags
export const PUBLIC_TAG_PARENT_IDS = [
    1515, 1507, 1513, 1504, 1502, 1509, 1506, 1501, 1514, 1511, 1500, 1503,
    1505, 1508, 1512, 1510, 1834, 1835,
]

// @Entity("charts")
// export class Chart extends BaseEntity {
//     @PrimaryGeneratedColumn() id!: number
//     @Column({ type: "json" }) config!: GrapherInterface
//     @Column() lastEditedAt!: Date
//     @Column() lastEditedByUserId!: number
//     @Column({ nullable: true }) publishedAt!: Date
//     @Column({ nullable: true }) publishedByUserId!: number
//     @Column() createdAt!: Date
//     @Column() updatedAt!: Date
//     @Column() isExplorable!: boolean

//     @ManyToOne(() => User, (user) => user.lastEditedCharts)
//     lastEditedByUser!: Relation<User>
//     @ManyToOne(() => User, (user) => user.publishedCharts)
//     publishedByUser!: Relation<User>
//     @OneToMany(() => ChartRevision, (rev) => rev.chart)
//     logs!: Relation<ChartRevision[]>
// }
// Only considers published charts, because only in that case the mapping slug -> id is unique
export async function mapSlugsToIds(
    knex: db.KnexReadonlyTransaction
): Promise<{ [slug: string]: number }> {
    const redirects = await db.knexRaw<{ chart_id: number; slug: string }>(
        knex,
        `SELECT chart_id, slug FROM chart_slug_redirects`
    )
    const rows = await db.knexRaw<{ id: number; slug: string }>(
        knex,
        `-- sql
    SELECT
        id,
        JSON_UNQUOTE(JSON_EXTRACT(config, "$.slug")) AS slug
    FROM charts
    WHERE config->>"$.isPublished" = "true"
`
    )

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
            `
SELECT csr.slug AS slug, c.config AS config, c.id AS id
FROM chart_slug_redirects csr
JOIN charts c
ON csr.chart_id = c.id
WHERE c.config -> "$.isPublished" = true
UNION
SELECT c.slug AS slug, c.config AS config, c.id AS id
FROM charts c
WHERE c.config -> "$.isPublished" = true
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
): Promise<DbEnrichedChart | null> {
    let chart = await db.knexRawFirst<DbRawChart>(
        knex,
        `SELECT * FROM charts WHERE config ->> '$.slug' = ?`,
        [slug]
    )

    if (!chart) {
        chart = await db.knexRawFirst<DbRawChart>(
            knex,
            `select c.*
            from chart_slug_redirects csr
            join charts c on csr.chart_id = c.id
            where csr.slug = ?`,
            [slug]
        )
    }

    if (!chart) return null

    const enrichedChart = parseChartsRow(chart)

    return enrichedChart
}

export async function getRawChartById(
    knex: db.KnexReadonlyTransaction,
    id: number
): Promise<DbRawChart | null> {
    const chart = await db.knexRawFirst<DbRawChart>(
        knex,
        `SELECT * FROM charts WHERE id = ?`,
        [id]
    )
    if (!chart) return null
    return chart
}

export async function getEnrichedChartById(
    knex: db.KnexReadonlyTransaction,
    id: number
): Promise<DbEnrichedChart | null> {
    const rawChart = await getRawChartById(knex, id)
    if (!rawChart) return null
    return parseChartsRow(rawChart)
}

export async function getChartSlugById(
    knex: db.KnexReadonlyTransaction,
    id: number
): Promise<string | null> {
    const chart = await db.knexRawFirst<Pick<DbRawChart, "slug">>(
        knex,
        `SELECT config ->> '$.slug' FROM charts WHERE id = ?`,
        [id]
    )
    if (!chart) return null
    return chart.slug
}

export const getChartConfigById = async (
    knex: db.KnexReadonlyTransaction,
    grapherId: number
): Promise<Pick<DbEnrichedChart, "id" | "config"> | undefined> => {
    const grapher = await db.knexRawFirst<Pick<DbRawChart, "id" | "config">>(
        knex,
        `SELECT id, config FROM charts WHERE id=?`,
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
): Promise<Pick<DbEnrichedChart, "id" | "config">> {
    const row = await db.knexRawFirst<Pick<DbRawChart, "id" | "config">>(
        knex,
        `SELECT id, config FROM charts WHERE JSON_EXTRACT(config, "$.slug") = ?`,
        [slug]
    )

    if (!row) throw new JsonError(`No chart found for slug ${slug}`, 404)

    return { id: row.id, config: JSON.parse(row.config) }
}

export async function setChartTags(
    knex: db.KnexReadWriteTransaction,
    chartId: number,
    tags: DbChartTagJoin[]
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
              "select parentId from tags where id in (?)",
              [tags.map((t) => t.id)]
          )
        : []

    // A chart is indexable if it is not tagged "Unlisted" and has at
    // least one public parent tag
    const isIndexable = tags.some((t) => t.name === "Unlisted")
        ? false
        : parentIds.some((t) => PUBLIC_TAG_PARENT_IDS.includes(t.parentId))
    await db.knexRaw(knex, "update charts set is_indexable = ? where id = ?", [
        isIndexable,
        chartId,
    ])
}

export async function assignTagsForCharts(
    knex: db.KnexReadonlyTransaction,
    charts: {
        id: number
        tags?: {
            id: number
            name: string
            keyChartLevel: number
            isApproved: boolean
        }[]
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

    const chartConfigOnly: Pick<DbRawChart, "config"> | undefined = await knex
        .table<DbRawChart>("charts")
        .select("config")
        .where({ id: chartId })
        .first()
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

    const prompt = `
            You will be provided with the chart metadata (delimited with XML tags),
            as well as a list of possible topics (delimited with XML tags).
            Classify the chart into two of the provided topics.
            <chart>
                <title>${enrichedChartConfig.title}</title>
                <description>${enrichedChartConfig.subtitle}</description>
                <listed-on>${enrichedChartConfig.originUrl}</listed-on>
            </chart>
            <topics>
                ${topics.map(
                    (topic) => `<topic id=${topic.id}>${topic.name}</topic>\n`
                )}
            </topics>

            Respond with the two categories you think best describe the chart.

            Format your response as follows:
            [
                { "id": 1, "name": "Topic 1" },
                { "id": 2, "name": "Topic 2" }
            ]`

    const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
    })
    const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "gpt-4-1106-preview",
    })

    const json = completion.choices[0]?.message?.content
    if (!json) throw new JsonError("No response from GPT", 500)

    const selectedTopics: unknown = JSON.parse(json)

    if (lodash.isArray(selectedTopics)) {
        // We only want to return topics that are in the list of possible
        // topics, in case of hallucinations
        const confirmedTopics = selectedTopics.filter((topic) =>
            topics.map((t) => t.id).includes(topic.id)
        )

        return confirmedTopics
    } else {
        console.error("GPT returned invalid response", json)
        return []
    }
}

export interface OldChartFieldList {
    id: number
    title: string
    slug: string
    type: string
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
        charts.config->>"$.title" AS title,
        charts.config->>"$.slug" AS slug,
        charts.config->>"$.type" AS type,
        charts.config->>"$.internalNotes" AS internalNotes,
        charts.config->>"$.variantName" AS variantName,
        charts.config->>"$.isPublished" AS isPublished,
        charts.config->>"$.tab" AS tab,
        JSON_EXTRACT(charts.config, "$.hasChartTab") = true AS hasChartTab,
        JSON_EXTRACT(charts.config, "$.hasMapTab") = true AS hasMapTab,
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
    chartType: ChartTypeName,
    count = 10
): Promise<number[]> => {
    const ids = await db.knexRaw<{ id: number }>(
        knex,
        `SELECT c.id
        FROM analytics_pageviews a
        JOIN charts c ON c.slug = SUBSTRING_INDEX(a.url, '/', -1)
        WHERE a.url LIKE "https://ourworldindata.org/grapher/%"
            AND c.type = ?
            AND c.config ->> "$.isPublished" = "true"
            and (c.config ->> "$.hasChartTab" = "true" or c.config ->> "$.hasChartTab" is null)
        ORDER BY a.views_365d DESC
        LIMIT ?`,
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
                    charts.config->>"$.slug" AS slug,
                    charts.config->>"$.title" AS title,
                    charts.config->>"$.variantName" AS variantName,
                    MAX(chart_tags.keyChartLevel) as keyChartLevel
                FROM charts
                INNER JOIN chart_tags ON charts.id=chart_tags.chartId
                WHERE JSON_CONTAINS(config->'$.dimensions', '{"variableId":${variableId}}')
                AND charts.config->>"$.isPublished" = "true"
                ${excludeChartIds}
                GROUP BY charts.id
                ORDER BY title ASC
            `
    )
}

export const getChartEmbedUrlsInPublishedWordpressPosts = async (
    knex: db.KnexReadonlyTransaction
): Promise<string[]> => {
    const chartSlugQueryString: Pick<
        DbPlainPostLink,
        "target" | "queryString"
    >[] = await db.knexRaw(
        knex,
        `-- sql
            SELECT
                pl.target,
                pl.queryString
            FROM
                posts_links pl
                JOIN posts p ON p.id = pl.sourceId
            WHERE
                pl.linkType = "grapher"
                AND pl.componentType = "src"
                AND p.status = "publish"
                AND p.type != 'wp_block'
                AND p.slug NOT IN (
                    -- We want to exclude the slugs of published gdocs, since they override the Wordpress posts
                    -- published under the same slugs.
                    SELECT
                        slug from posts_gdocs pg
                    WHERE
                        pg.slug = p.slug
                        AND pg.content ->> '$.type' <> 'fragment'
                        AND pg.published = 1
                )
        -- Commenting this out since we currently don't do anything with the baked embeds in gdocs posts
        -- see https://github.com/owid/owid-grapher/issues/2992#issuecomment-1934690219
        -- Rename to getChartEmbedUrlsInPublishedPosts if we decide to use this
        --  UNION
        --  SELECT
        --      pgl.target,
        --      pgl.queryString
        --  FROM
        --      posts_gdocs_links pgl
        --      JOIN posts_gdocs pg on pg.id = pgl.sourceId
        --  WHERE
        --      pgl.linkType = "grapher"
        --      AND pgl.componentType = "chart"
        --      AND pg.content ->> '$.type' <> 'fragment'
        --      AND pg.published = 1
    `
    )

    return chartSlugQueryString.map((row) => {
        return `${BAKED_BASE_URL}/${row.target}${row.queryString}`
    })
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
