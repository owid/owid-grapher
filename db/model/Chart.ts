import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne,
    OneToMany,
    type Relation,
} from "typeorm"
import * as lodash from "lodash"
import * as db from "../db.js"
import { getDataForMultipleVariables } from "./Variable.js"
import { User } from "./User.js"
import { ChartRevision } from "./ChartRevision.js"
import {
    JsonError,
    KeyChartLevel,
    MultipleOwidVariableDataDimensionsMap,
    Tag,
    DbChartTagJoin,
} from "@ourworldindata/utils"
import {
    GrapherInterface,
    ChartTypeName,
    RelatedChart,
    DbPlainPostLink,
} from "@ourworldindata/types"
import { OpenAI } from "openai"
import {
    BAKED_BASE_URL,
    OPENAI_API_KEY,
} from "../../settings/serverSettings.js"
import { Knex } from "knex"

// XXX hardcoded filtering to public parent tags
export const PUBLIC_TAG_PARENT_IDS = [
    1515, 1507, 1513, 1504, 1502, 1509, 1506, 1501, 1514, 1511, 1500, 1503,
    1505, 1508, 1512, 1510, 1834, 1835,
]

@Entity("charts")
export class Chart extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column({ type: "json" }) config!: GrapherInterface
    @Column() lastEditedAt!: Date
    @Column() lastEditedByUserId!: number
    @Column({ nullable: true }) publishedAt!: Date
    @Column({ nullable: true }) publishedByUserId!: number
    @Column() createdAt!: Date
    @Column() updatedAt!: Date

    @ManyToOne(() => User, (user) => user.lastEditedCharts)
    lastEditedByUser!: Relation<User>
    @ManyToOne(() => User, (user) => user.publishedCharts)
    publishedByUser!: Relation<User>
    @OneToMany(() => ChartRevision, (rev) => rev.chart)
    logs!: Relation<ChartRevision[]>

    static table: string = "charts"

    // Only considers published charts, because only in that case the mapping slug -> id is unique
    static async mapSlugsToIds(): Promise<{ [slug: string]: number }> {
        const redirects = await db.queryMysql(
            `SELECT chart_id, slug FROM chart_slug_redirects`
        )
        const rows = await db.queryMysql(`
            SELECT
                id,
                JSON_UNQUOTE(JSON_EXTRACT(config, "$.slug")) AS slug
            FROM charts
            WHERE config->>"$.isPublished" = "true"
        `)

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
    static async mapSlugsToConfigs(): Promise<
        { slug: string; id: number; config: GrapherInterface }[]
    > {
        return db
            .queryMysql(
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
                results.map(
                    (result: { slug: string; id: number; config: string }) => ({
                        ...result,
                        config: JSON.parse(result.config),
                    })
                )
            )
    }

    static async getBySlug(slug: string): Promise<Chart | null> {
        const slugToIdMap = await this.mapSlugsToIds()
        const chartId = slugToIdMap[slug]
        if (chartId === undefined) return null
        return await Chart.findOneBy({ id: chartId })
    }

    static async getById(id: number): Promise<Chart | null> {
        return await Chart.findOneBy({ id })
    }

    static async setTags(
        chartId: number,
        tags: DbChartTagJoin[]
    ): Promise<void> {
        await db.transaction(async (t) => {
            const tagRows = tags.map((tag) => [
                tag.id,
                chartId,
                tag.keyChartLevel ?? KeyChartLevel.None,
                tag.isApproved ? 1 : 0,
            ])
            await t.execute(`DELETE FROM chart_tags WHERE chartId=?`, [chartId])
            if (tagRows.length)
                await t.execute(
                    `INSERT INTO chart_tags (tagId, chartId, keyChartLevel, isApproved) VALUES ?`,
                    [tagRows]
                )

            const parentIds = tags.length
                ? ((await t.query("select parentId from tags where id in (?)", [
                      tags.map((t) => t.id),
                  ])) as { parentId: number }[])
                : []

            // A chart is indexable if it is not tagged "Unlisted" and has at
            // least one public parent tag
            const isIndexable = tags.some((t) => t.name === "Unlisted")
                ? false
                : parentIds.some((t) =>
                      PUBLIC_TAG_PARENT_IDS.includes(t.parentId)
                  )
            await t.execute("update charts set is_indexable = ? where id = ?", [
                isIndexable,
                chartId,
            ])
        })
    }

    static async assignTagsForCharts(
        charts: { id: number; tags: any[] }[]
    ): Promise<void> {
        const chartTags = await db.queryMysql(`
            SELECT ct.chartId, ct.tagId, ct.keyChartLevel, ct.isApproved, t.name as tagName FROM chart_tags ct
            JOIN charts c ON c.id=ct.chartId
            JOIN tags t ON t.id=ct.tagId
        `)

        for (const chart of charts) {
            chart.tags = []
        }

        const chartsById = lodash.keyBy(charts, (c) => c.id)

        for (const ct of chartTags) {
            const chart = chartsById[ct.chartId]
            if (chart)
                chart.tags.push({
                    id: ct.tagId,
                    name: ct.tagName,
                    keyChartLevel: ct.keyChartLevel,
                    isApproved: !!ct.isApproved,
                })
        }
    }

    static async getGptTopicSuggestions(
        chartId: number
    ): Promise<Pick<Tag, "id" | "name">[]> {
        if (!OPENAI_API_KEY)
            throw new JsonError("No OPENAI_API_KEY env found", 500)

        const chart = await Chart.findOneBy({
            id: chartId,
        })
        if (!chart) throw new JsonError(`No chart found for id ${chartId}`, 404)

        const topics: Pick<Tag, "id" | "name">[] = await db.queryMysql(`
        SELECT t.id, t.name
            FROM tags t
            WHERE t.slug IS NOT NULL
            AND t.parentId IN (${PUBLIC_TAG_PARENT_IDS.join(",")})
        `)

        if (!topics.length) throw new JsonError("No topics found", 404)

        const prompt = `
            You will be provided with the chart metadata (delimited with XML tags),
            as well as a list of possible topics (delimited with XML tags).
            Classify the chart into two of the provided topics.
            <chart>
                <title>${chart.config.title}</title>
                <description>${chart.config.subtitle}</description>
                <listed-on>${chart.config.originUrl}</listed-on>
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

    static async all(): Promise<ChartRow[]> {
        const rows = await db.knexTable(Chart.table)

        for (const row of rows) {
            row.config = JSON.parse(row.config)
        }

        return rows as ChartRow[] // This cast might be a lie?
    }
}

interface ChartRow {
    id: number
    config: any
}

// TODO integrate this old logic with typeorm
export class OldChart {
    static listFields = `
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

    static async getBySlug(slug: string): Promise<OldChart> {
        const row = await db.mysqlFirst(
            `SELECT id, config FROM charts WHERE JSON_EXTRACT(config, "$.slug") = ?`,
            [slug]
        )

        return new OldChart(row.id, JSON.parse(row.config))
    }

    id: number
    config: any
    constructor(id: number, config: Record<string, unknown>) {
        this.id = id
        this.config = config

        // XXX todo make the relationship between chart models and chart configuration more defined
        this.config.id = id
    }

    async getVariableData(): Promise<MultipleOwidVariableDataDimensionsMap> {
        const variableIds = lodash.uniq(
            this.config.dimensions!.map((d: any) => d.variableId)
        )
        const allVariablesDataAndMetadataMap =
            await getDataForMultipleVariables(variableIds as number[])
        return allVariablesDataAndMetadataMap
    }
}

export const getGrapherById = async (grapherId: number): Promise<any> => {
    const grapher = (
        await db.queryMysql(`SELECT id, config FROM charts WHERE id=?`, [
            grapherId,
        ])
    )[0]

    if (!grapher) return undefined

    const config = JSON.parse(grapher.config)
    config.id = grapher.id
    return config
}

export const getMostViewedGrapherIdsByChartType = async (
    chartType: ChartTypeName,
    count = 10
): Promise<number[]> => {
    const ids = await db.queryMysql(
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
    return ids.map((row: any) => row.id)
}

export const getRelatedChartsForVariable = async (
    variableId: number,
    chartIdsToExclude: number[] = []
): Promise<RelatedChart[]> => {
    const excludeChartIds =
        chartIdsToExclude.length > 0
            ? `AND charts.id NOT IN (${chartIdsToExclude.join(", ")})`
            : ""

    return db.queryMysql(`-- sql
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
            `)
}

export const getChartEmbedUrlsInPublishedWordpressPosts = async (
    knex: Knex<any, any[]>
): Promise<string[]> => {
    const chartSlugQueryString: Pick<
        DbPlainPostLink,
        "target" | "queryString"
    >[] = await db.knexRaw(
        knex,
        `
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
