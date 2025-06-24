import * as _ from "lodash-es"
import { MarkdownTextWrap } from "@ourworldindata/components"
import { KeyChartLevel, ContentGraphLinkType } from "@ourworldindata/types"
import * as db from "../../../db/db.js"
import {
    ChartRecord,
    ChartRecordType,
} from "../../../site/search/searchTypes.js"
import { getAnalyticsPageviewsByUrlObj } from "../../../db/model/Pageview.js"
import { getRelatedArticles } from "../../../db/model/Post.js"
import { getPublishedLinksTo } from "../../../db/model/Link.js"
import { isPathRedirectedToExplorer } from "../../../explorerAdminServer/ExplorerRedirects.js"
import { ParsedChartRecordRow, RawChartRecordRow } from "./types.js"
import {
    excludeNullish,
    getUniqueNamesFromTagHierarchies,
} from "@ourworldindata/utils"
import { processAvailableEntities } from "./shared.js"

const computeChartScore = (record: Omit<ChartRecord, "score">): number => {
    const { numRelatedArticles, views_7d } = record
    return numRelatedArticles * 500 + views_7d
}

const parseAndProcessChartRecords = (
    rawRecord: RawChartRecordRow
): ParsedChartRecordRow => {
    let parsedEntities: string[] = []
    if (rawRecord.entityNames !== null) {
        // This is a very rough way to check for the Algolia record size limit, but it's better than the update failing
        // because we exceed the 20KB record size limit
        if (rawRecord.entityNames.length < 12000)
            parsedEntities = excludeNullish(
                JSON.parse(rawRecord.entityNames as string) as (string | null)[]
            ) as string[]
        else {
            console.info(
                `Chart ${rawRecord.id} has too many entities, skipping its entities`
            )
        }
    }
    const entityNames = processAvailableEntities(parsedEntities)

    const tags = JSON.parse(rawRecord.tags)
    const keyChartForTags = JSON.parse(
        rawRecord.keyChartForTags as string
    ).filter((t: string | null) => t)

    return {
        ...rawRecord,
        entityNames,
        tags,
        keyChartForTags,
    }
}

export const getChartsRecords = async (
    knex: db.KnexReadonlyTransaction
): Promise<ChartRecord[]> => {
    console.log("Fetching charts to index")
    const chartsToIndex = await db.knexRaw<RawChartRecordRow>(
        knex,
        `-- sql
        WITH indexable_charts_with_entity_names AS (
            SELECT c.id,
                   cc.slug,
                   cc.full ->> "$.title"                   AS title,
                   cc.full ->> "$.variantName"             AS variantName,
                   cc.full ->> "$.subtitle"                AS subtitle,
                   JSON_LENGTH(cc.full ->> "$.dimensions") AS numDimensions,
                   c.publishedAt,
                   c.updatedAt,
                   JSON_ARRAYAGG(e.name)                  AS entityNames
            FROM charts c
                     LEFT JOIN chart_configs cc ON c.configId = cc.id
                     LEFT JOIN charts_x_entities ce ON c.id = ce.chartId
                     LEFT JOIN entities e ON ce.entityId = e.id
            WHERE cc.full ->> "$.isPublished" = 'true'
                AND c.isIndexable IS TRUE
            GROUP BY c.id
        )
        SELECT c.id,
               c.slug,
               c.title,
               c.variantName,
               c.subtitle,
               c.numDimensions,
               c.publishedAt,
               c.updatedAt,
               c.entityNames, -- this array may contain null values, will have to filter these out
               JSON_ARRAYAGG(t.name) AS tags,
               JSON_ARRAYAGG(IF(ct.keyChartLevel = ${KeyChartLevel.Top}, t.name, NULL)) AS keyChartForTags -- this results in an array that contains null entries, will have to filter them out
        FROM indexable_charts_with_entity_names c
                 LEFT JOIN chart_tags ct ON c.id = ct.chartId
                 LEFT JOIN tags t on ct.tagId = t.id
        GROUP BY c.id
        HAVING COUNT(t.id) >= 1
    `
    )

    const parsedRows = chartsToIndex.map(parseAndProcessChartRecords)

    const pageviews = await getAnalyticsPageviewsByUrlObj(knex)

    const topicHierarchiesByChildName =
        await db.getTopicHierarchiesByChildName(knex)

    const records: ChartRecord[] = []
    for (const c of parsedRows) {
        // Our search currently cannot render explorers, so don't index them because
        // otherwise they will fail when rendered in the search results
        if (isPathRedirectedToExplorer(`/grapher/${c.slug}`)) continue

        const relatedArticles = (await getRelatedArticles(knex, c.id)) ?? []
        const linksFromGdocs = await getPublishedLinksTo(
            knex,
            [c.slug],
            ContentGraphLinkType.Grapher
        )

        const plaintextSubtitle = _.isNil(c.subtitle)
            ? undefined
            : new MarkdownTextWrap({
                  text: c.subtitle,
                  fontSize: 10, // doesn't matter, but is a mandatory field
              }).plaintext

        const topicTags = new Set<string>(
            c.tags.flatMap((tagName) => {
                const topicHierarchies = topicHierarchiesByChildName[tagName]
                // a chart can be tagged with a tag that isn't in the tag graph
                if (!topicHierarchies) return []
                return getUniqueNamesFromTagHierarchies(topicHierarchies)
            })
        )

        const record = {
            objectID: c.id.toString(),
            id: `grapher/${c.slug}`,
            type: ChartRecordType.Chart,
            chartId: c.id,
            slug: c.slug,
            title: c.title,
            variantName: c.variantName,
            subtitle: plaintextSubtitle,
            availableEntities: c.entityNames,
            numDimensions: parseInt(c.numDimensions),
            publishedAt: c.publishedAt,
            updatedAt: c.updatedAt,
            tags: [...topicTags],
            keyChartForTags: c.keyChartForTags as string[],
            titleLength: c.title.length,
            // Number of references to this chart in all our posts and pages
            numRelatedArticles: relatedArticles.length + linksFromGdocs.length,
            views_7d: pageviews[`/grapher/${c.slug}`]?.views_7d ?? 0,
            isIncomeGroupSpecificFM: false,
        } as ChartRecord
        const score = computeChartScore(record)
        records.push({ ...record, score })
    }

    return records
}
