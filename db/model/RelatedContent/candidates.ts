import { TagGraphRootName } from "@ourworldindata/types"
import * as db from "../../db.js"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"
import { Candidate, RelatedContentType, SourcePage } from "./types.js"

interface GdocCandidateRow {
    slug: string
    title: string
    type: string
    tagIds: string
    publishedAt: Date | null
    pageviews: number
}

interface GrapherCandidateRow {
    slug: string
    title: string
    tagIds: string
    variableIds: string
    publishedAt: Date | null
    pageviews: number
    keyChartLevel: number
}

const gdocTypeToRelatedType = (
    rawType: string
): RelatedContentType | undefined => {
    switch (rawType) {
        case "article":
            return "article"
        case "topic-page":
        case "linear-topic-page":
            return "topic-page"
        case "data-insight":
            return "data-insight"
        default:
            return undefined
    }
}

const parseIdList = (raw: string | null): number[] => {
    if (!raw) return []
    return JSON.parse(raw) as number[]
}

const buildGdocUrl = (slug: string, type: RelatedContentType): string => {
    if (type === "data-insight")
        return `${BAKED_BASE_URL}/data-insights/${slug}`
    return `${BAKED_BASE_URL}/${slug}`
}

// Expand a set of tag IDs to every tag that lives under the same topic-area
// ancestor. "Areas" are the direct children of the tag-graph root (e.g.
// "Energy and Environment"); we walk up to find each source tag's area
// ancestors, then walk down to enumerate every descendant. The result is the
// union of the original IDs and all in-area descendants. Used to widen the
// candidate pool from "shares a topic tag" to "shares a topic area".
//
// Perf note: the tag_graph + root lookup runs once *per chart* today. At 14
// charts (ENABLED_SLUGS) the cost is negligible. If this is scaled to the
// full data-page corpus, hoist the loaded graph into `PipelineDeps` so a
// bake run only fetches it once.
const getAreaExpandedTagIds = async (
    knex: db.KnexReadonlyTransaction,
    tagIds: number[]
): Promise<number[]> => {
    if (tagIds.length === 0) return []

    const [edges, rootRow] = await Promise.all([
        db.knexRaw<{ parentId: number; childId: number }>(
            knex,
            `SELECT parentId, childId FROM tag_graph`
        ),
        db.knexRawFirst<{ id: number }>(
            knex,
            `SELECT id FROM tags WHERE name = ?`,
            [TagGraphRootName]
        ),
    ])
    if (!rootRow) return tagIds
    const rootId = rootRow.id

    const parentsByChild = new Map<number, number[]>()
    const childrenByParent = new Map<number, number[]>()
    for (const { parentId, childId } of edges) {
        if (!parentsByChild.has(childId)) parentsByChild.set(childId, [])
        parentsByChild.get(childId)!.push(parentId)
        if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, [])
        childrenByParent.get(parentId)!.push(childId)
    }
    const areaIds = new Set(childrenByParent.get(rootId) ?? [])

    const sourceAreas = new Set<number>()
    for (const tagId of tagIds) {
        const queue = [tagId]
        const seen = new Set<number>()
        while (queue.length > 0) {
            const node = queue.shift()!
            if (seen.has(node)) continue
            seen.add(node)
            if (areaIds.has(node)) {
                sourceAreas.add(node)
                continue
            }
            for (const p of parentsByChild.get(node) ?? []) {
                if (p !== rootId) queue.push(p)
            }
        }
    }

    const expanded = new Set<number>(tagIds)
    for (const areaId of sourceAreas) {
        const queue = [areaId]
        while (queue.length > 0) {
            const node = queue.shift()!
            if (expanded.has(node)) continue
            expanded.add(node)
            for (const c of childrenByParent.get(node) ?? []) queue.push(c)
        }
    }

    return [...expanded]
}

export const getSourcePage = async (
    knex: db.KnexReadonlyTransaction,
    chartId: number
): Promise<SourcePage> => {
    const row = await db.knexRawFirst<{
        slug: string
        title: string
        tagIds: string | null
        variableIds: string | null
    }>(
        knex,
        `-- sql
        SELECT
            cc.slug AS slug,
            cc.full ->> '$.title' AS title,
            (
                SELECT JSON_ARRAYAGG(ct.tagId)
                FROM chart_tags ct
                WHERE ct.chartId = c.id
            ) AS tagIds,
            (
                SELECT JSON_ARRAYAGG(cd.variableId)
                FROM chart_dimensions cd
                WHERE cd.chartId = c.id AND cd.property IN ('x', 'y')
            ) AS variableIds
        FROM charts c
        JOIN chart_configs cc ON cc.id = c.configId
        WHERE c.id = ?
        `,
        [chartId]
    )
    if (!row)
        throw new Error(
            `No chart found with id ${chartId} when building source`
        )
    const tagIds = parseIdList(row.tagIds)
    const expandedTagIds = await getAreaExpandedTagIds(knex, tagIds)
    return {
        chartId,
        slug: row.slug,
        url: `${BAKED_BASE_URL}/grapher/${row.slug}`,
        title: row.title,
        tagIds,
        expandedTagIds,
        variableIds: parseIdList(row.variableIds),
    }
}

export const getGdocCandidates = async (
    knex: db.KnexReadonlyTransaction,
    source: SourcePage
): Promise<Candidate[]> => {
    if (source.expandedTagIds.length === 0 && source.variableIds.length === 0)
        return []

    const tagJoinRows: GdocCandidateRow[] =
        source.expandedTagIds.length > 0
            ? await db.knexRaw<GdocCandidateRow>(
                  knex,
                  `-- sql
            SELECT DISTINCT
                pg.slug AS slug,
                pg.content ->> '$.title' AS title,
                pg.type AS type,
                (
                    SELECT JSON_ARRAYAGG(pt.tagId)
                    FROM posts_gdocs_x_tags pt
                    WHERE pt.gdocId = pg.id
                ) AS tagIds,
                pg.publishedAt AS publishedAt,
                COALESCE(pv.views_365d, 0) AS pageviews
            FROM posts_gdocs pg
            JOIN posts_gdocs_x_tags pgxt ON pgxt.gdocId = pg.id
            LEFT JOIN analytics_pageviews pv
                ON pv.url = CONCAT('https://ourworldindata.org/', pg.slug)
            WHERE pgxt.tagId IN (?)
              AND pg.published = 1
              AND pg.type IN ('article', 'topic-page', 'linear-topic-page', 'data-insight')
            `,
                  [source.expandedTagIds]
              )
            : []

    const variableJoinRows: GdocCandidateRow[] =
        source.variableIds.length > 0
            ? await db.knexRaw<GdocCandidateRow>(
                  knex,
                  `-- sql
            SELECT DISTINCT
                pg.slug AS slug,
                pg.content ->> '$.title' AS title,
                pg.type AS type,
                (
                    SELECT JSON_ARRAYAGG(pt.tagId)
                    FROM posts_gdocs_x_tags pt
                    WHERE pt.gdocId = pg.id
                ) AS tagIds,
                pg.publishedAt AS publishedAt,
                COALESCE(pv.views_365d, 0) AS pageviews
            FROM posts_gdocs_links pl
            JOIN posts_gdocs pg ON pl.sourceId = pg.id
            LEFT JOIN chart_configs cc ON pl.target = cc.slug
            LEFT JOIN charts c ON c.configId = cc.id
            LEFT JOIN chart_slug_redirects csr ON pl.target = csr.slug
            JOIN chart_dimensions cd ON cd.chartId = COALESCE(csr.chart_id, c.id)
            LEFT JOIN analytics_pageviews pv
                ON pv.url = CONCAT('https://ourworldindata.org/', pg.slug)
            WHERE pl.linkType = 'grapher'
              AND pl.componentType = 'chart'
              AND cd.variableId IN (?)
              AND cd.property IN ('x', 'y')
              AND pg.published = 1
              AND pg.type IN ('article', 'topic-page', 'linear-topic-page', 'data-insight')
            `,
                  [source.variableIds]
              )
            : []

    const merged = new Map<string, Candidate>()
    for (const row of [...tagJoinRows, ...variableJoinRows]) {
        const type = gdocTypeToRelatedType(row.type)
        if (!type) continue
        const url = buildGdocUrl(row.slug, type)
        if (merged.has(url)) continue
        merged.set(url, {
            url,
            title: row.title,
            type,
            tagIds: parseIdList(row.tagIds),
            variableIds: [],
            publishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
            pageviews: Number(row.pageviews) || 0,
            keyChartLevel: 0,
        })
    }
    return [...merged.values()]
}

export const getGrapherCandidates = async (
    knex: db.KnexReadonlyTransaction,
    source: SourcePage
): Promise<Candidate[]> => {
    if (source.expandedTagIds.length === 0) return []

    const rows = await db.knexRaw<GrapherCandidateRow>(
        knex,
        `-- sql
        SELECT DISTINCT
            cc.slug AS slug,
            cc.full ->> '$.title' AS title,
            (
                SELECT JSON_ARRAYAGG(ct2.tagId)
                FROM chart_tags ct2
                WHERE ct2.chartId = c.id
            ) AS tagIds,
            (
                SELECT JSON_ARRAYAGG(cd.variableId)
                FROM chart_dimensions cd
                WHERE cd.chartId = c.id AND cd.property IN ('x', 'y')
            ) AS variableIds,
            c.publishedAt AS publishedAt,
            COALESCE(pv.views_365d, 0) AS pageviews,
            (
                SELECT COALESCE(MAX(ct3.keyChartLevel), 0)
                FROM chart_tags ct3
                WHERE ct3.chartId = c.id AND ct3.tagId IN (?)
            ) AS keyChartLevel
        FROM chart_tags ct
        JOIN charts c ON c.id = ct.chartId
        JOIN chart_configs cc ON cc.id = c.configId
        LEFT JOIN analytics_pageviews pv
            ON pv.url = CONCAT('https://ourworldindata.org/grapher/', cc.slug)
        WHERE ct.tagId IN (?)
          AND c.id <> ?
          AND c.publishedAt IS NOT NULL
          -- Mirror the Algolia chart-index predicate
          -- (baker/algolia/utils/charts.ts:132–161) so every candidate
          -- has a chance of resolving to a hit on the client, where the
          -- IndicatorRow defers to SearchChartHitComponent. Without
          -- this, non-indexable graphers fall back to the single-
          -- thumbnail placeholder. Two clauses:
          --   1) NOT tagged "Unlisted"
          --   2) has at least one tag that is either
          --      searchableInAlgolia=TRUE OR maps to a published
          --      topic-page / linear-topic-page gdoc.
          AND NOT EXISTS (
            SELECT 1 FROM chart_tags ct_unlisted
            JOIN tags t_unlisted ON ct_unlisted.tagId = t_unlisted.id
            WHERE ct_unlisted.chartId = c.id
              AND t_unlisted.name = 'Unlisted'
          )
          -- Exclude scatter charts from the candidate pool. Scatters are
          -- visually dense and require X/Y axis context, which makes them
          -- a poor fit for the "skim and click" UX of the Up-next feed
          -- (and they're disproportionately picked by the embedding +
          -- tag-IDF scoring because they span many variables).
          AND (
            cc.full ->> '$.chartTypes' IS NULL
            OR NOT JSON_CONTAINS(cc.full -> '$.chartTypes', '"ScatterPlot"')
          )
          AND EXISTS (
            SELECT 1 FROM chart_tags ct_topic
            JOIN tags t_topic ON ct_topic.tagId = t_topic.id
            LEFT JOIN posts_gdocs pg ON pg.slug = t_topic.slug
            WHERE ct_topic.chartId = c.id
              AND (
                t_topic.searchableInAlgolia = TRUE
                OR (
                    pg.published = TRUE
                    AND pg.type IN ('topic-page', 'linear-topic-page')
                )
              )
          )
        `,
        [source.tagIds, source.expandedTagIds, source.chartId]
    )

    return rows.map((row) => ({
        url: `${BAKED_BASE_URL}/grapher/${row.slug}`,
        title: row.title,
        type: "grapher" as const,
        tagIds: parseIdList(row.tagIds),
        variableIds: parseIdList(row.variableIds),
        publishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
        pageviews: Number(row.pageviews) || 0,
        keyChartLevel: Number(row.keyChartLevel) || 0,
    }))
}

export const getCandidatePool = async (
    knex: db.KnexReadonlyTransaction,
    source: SourcePage
): Promise<Candidate[]> => {
    const [gdocs, graphers] = await Promise.all([
        getGdocCandidates(knex, source),
        getGrapherCandidates(knex, source),
    ])
    const dedup = new Map<string, Candidate>()
    for (const c of [...gdocs, ...graphers]) dedup.set(c.url, c)
    dedup.delete(source.url)
    return [...dedup.values()]
}

export const getTagDocumentFrequency = async (
    knex: db.KnexReadonlyTransaction
): Promise<{ docFreq: Map<number, number>; totalDocs: number }> => {
    const rows = await db.knexRaw<{ tagId: number; docCount: number }>(
        knex,
        `-- sql
        SELECT tagId, COUNT(*) AS docCount FROM (
            SELECT tagId, chartId AS docId FROM chart_tags
            UNION ALL
            SELECT tagId, gdocId AS docId FROM posts_gdocs_x_tags
        ) t
        GROUP BY tagId
        `
    )
    const docFreq = new Map<number, number>()
    let totalDocs = 0
    for (const row of rows) {
        docFreq.set(row.tagId, row.docCount)
        totalDocs += row.docCount
    }
    return { docFreq, totalDocs }
}
