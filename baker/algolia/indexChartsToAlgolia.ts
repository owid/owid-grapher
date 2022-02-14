import * as lodash from "lodash-es"

import * as db from "../../db/db.js"
import { getRelatedArticles } from "../../db/wpdb.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { isPathRedirectedToExplorer } from "../../explorerAdminServer/ExplorerRedirects.js"

const getChartsRecords = async () => {
    const allCharts = await db.queryMysql(`
        SELECT id, publishedAt, updatedAt, JSON_LENGTH(config->"$.dimensions") AS numDimensions, config->>"$.type" AS type, config->>"$.slug" AS slug, config->>"$.title" AS title, config->>"$.subtitle" AS subtitle, config->>"$.variantName" AS variantName, config->>"$.data.availableEntities" as availableEntitiesStr
        FROM charts
        WHERE publishedAt IS NOT NULL
        AND is_indexable IS TRUE
    `)

    const chartTags = await db.queryMysql(`
        SELECT ct.chartId, ct.tagId, t.name as tagName FROM chart_tags ct
        JOIN charts c ON c.id=ct.chartId
        JOIN tags t ON t.id=ct.tagId
    `)

    for (const c of allCharts) {
        c.tags = []
    }

    const chartsById = lodash.keyBy(allCharts, (c) => c.id)

    const chartsToIndex = []
    for (const ct of chartTags) {
        const c = chartsById[ct.chartId]
        if (c) {
            c.tags.push({ id: ct.tagId, name: ct.tagName })
            chartsToIndex.push(c)
        }
    }

    const records = []
    for (const c of chartsToIndex) {
        if (!c.tags) continue
        // Our search currently cannot render explorers, so don't index them because
        // otherwise they will fail when rendered in the search results
        if (isPathRedirectedToExplorer(`/grapher/${c.slug}`)) continue

        const relatedArticles = (await getRelatedArticles(c.slug)) ?? []

        records.push({
            objectID: c.id,
            chartId: c.id,
            slug: c.slug,
            title: c.title,
            variantName: c.variantName,
            subtitle: c.subtitle,
            _tags: c.tags.map((t: any) => t.name),
            availableEntities: JSON.parse(c.availableEntitiesStr),
            publishedAt: c.publishedAt,
            updatedAt: c.updatedAt,
            numDimensions: parseInt(c.numDimensions),
            titleLength: c.title.length,
            // Number of references to this chart in all our posts and pages
            numRelatedArticles: relatedArticles.length,
        })
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

    const index = client.initIndex("charts")

    const records = await getChartsRecords()
    await index.replaceAllObjects(records)

    await db.closeTypeOrmAndKnexConnections()
}

indexChartsToAlgolia()
