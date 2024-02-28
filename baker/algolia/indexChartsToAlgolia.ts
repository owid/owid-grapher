import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { isPathRedirectedToExplorer } from "../../explorerAdminServer/ExplorerRedirects.js"
import { ChartRecord, SearchIndexName } from "../../site/search/searchTypes.js"
import { KeyChartLevel, OwidGdocLinkType, isNil } from "@ourworldindata/utils"
import { MarkdownTextWrap } from "@ourworldindata/components"
import { getAnalyticsPageviewsByUrlObj } from "../../db/model/Pageview.js"
import { Link } from "../../db/model/Link.js"
import { getRelatedArticles } from "../../db/model/Post.js"
import { Knex } from "knex"
import { getIndexName } from "../../site/search/searchClient.js"

const computeScore = (record: Omit<ChartRecord, "score">): number => {
    const { numRelatedArticles, views_7d } = record
    return numRelatedArticles * 500 + views_7d
}

const getChartsRecords = async (
    knex: db.KnexReadonlyTransaction
): Promise<ChartRecord[]> => {
    const chartsToIndex = await db.queryMysql(`
    SELECT c.id,
        config ->> "$.slug"                   AS slug,
        config ->> "$.title"                  AS title,
        config ->> "$.variantName"            AS variantName,
        config ->> "$.subtitle"               AS subtitle,
        config ->> "$.data.availableEntities" AS availableEntities,
        JSON_LENGTH(config ->> "$.dimensions") AS numDimensions,
        c.publishedAt,
        c.updatedAt,
        JSON_ARRAYAGG(t.name) AS tags,
        JSON_ARRAYAGG(IF(ct.keyChartLevel = ${KeyChartLevel.Top} , t.name, NULL)) AS keyChartForTags -- this results in an array that contains null entries, will have to filter them out
    FROM charts c
        LEFT JOIN chart_tags ct ON c.id = ct.chartId
        LEFT JOIN tags t on ct.tagId = t.id
    WHERE config ->> "$.isPublished" = 'true'
        AND is_indexable IS TRUE
    GROUP BY c.id
    HAVING COUNT(t.id) >= 1
    `)

    for (const c of chartsToIndex) {
        if (c.availableEntities !== null) {
            // This is a very rough way to check for the Algolia record size limit, but it's better than the update failing
            // because we exceed the 20KB record size limit
            if (c.availableEntities.length < 12000)
                c.availableEntities = JSON.parse(c.availableEntities)
            else {
                console.info(
                    `Chart ${c.id} has too many entities, skipping its entities`
                )
                c.availableEntities = []
            }
        }

        c.tags = JSON.parse(c.tags)
        c.keyChartForTags = JSON.parse(c.keyChartForTags).filter(
            (t: string | null) => t
        )
    }

    const pageviews = await getAnalyticsPageviewsByUrlObj(knex)

    const records: ChartRecord[] = []
    for (const c of chartsToIndex) {
        // Our search currently cannot render explorers, so don't index them because
        // otherwise they will fail when rendered in the search results
        if (isPathRedirectedToExplorer(`/grapher/${c.slug}`)) continue

        const relatedArticles = (await getRelatedArticles(knex, c.id)) ?? []
        const linksFromGdocs = await Link.getPublishedLinksTo(
            c.slug,
            OwidGdocLinkType.Grapher
        )

        const plaintextSubtitle = isNil(c.subtitle)
            ? undefined
            : new MarkdownTextWrap({
                  text: c.subtitle,
                  fontSize: 10, // doesn't matter, but is a mandatory field
              }).plaintext

        const record = {
            objectID: c.id,
            chartId: c.id,
            slug: c.slug,
            title: c.title,
            variantName: c.variantName,
            subtitle: plaintextSubtitle,
            availableEntities: c.availableEntities,
            numDimensions: parseInt(c.numDimensions),
            publishedAt: c.publishedAt,
            updatedAt: c.updatedAt,
            tags: c.tags,
            keyChartForTags: c.keyChartForTags,
            titleLength: c.title.length,
            // Number of references to this chart in all our posts and pages
            numRelatedArticles: relatedArticles.length + linksFromGdocs.length,
            views_7d: pageviews[`/grapher/${c.slug}`]?.views_7d ?? 0,
        }
        const score = computeScore(record)
        records.push({ ...record, score })
    }

    return records
}

const indexChartsToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return

    const client = getAlgoliaClient()
    if (!client) {
        console.error(`Failed indexing charts (Algolia client not initialized)`)
        return
    }

    const index = client.initIndex(getIndexName(SearchIndexName.Charts))

    await db.getConnection()
    const records = await db.knexReadonlyTransaction(getChartsRecords)
    await index.replaceAllObjects(records)

    await db.closeTypeOrmAndKnexConnections()
}

process.on("unhandledRejection", (e) => {
    console.error(e)
    process.exit(1)
})

indexChartsToAlgolia()
