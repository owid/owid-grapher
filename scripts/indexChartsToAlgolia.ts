import * as algoliasearch from 'algoliasearch'
import * as _ from 'lodash'

import * as db from 'db/db'
import { ALGOLIA_ID } from 'settings'
import { ALGOLIA_SECRET_KEY } from 'serverSettings'
import { getIndexableCharts } from 'site/server/grapherUtil'

async function indexChartsToAlgolia() {
    const chartItems = await db.query(`
        SELECT id, publishedAt, updatedAt, JSON_LENGTH(config->"$.dimensions") AS numDimensions, config->>"$.type" AS type, config->>"$.slug" AS slug, config->>"$.title" AS title, config->>"$.subtitle" AS subtitle, config->>"$.variantName" AS variantName
        FROM charts 
        WHERE publishedAt IS NOT NULL
    `)

    const chartTags = await db.query(`
        SELECT ct.chartId, ct.tagId, t.name as tagName, t.parentId as tagParentId FROM chart_tags ct
        JOIN charts c ON c.id=ct.chartId
        JOIN tags t ON t.id=ct.tagId
    `)

    for (const c of chartItems) {
        c.tags = []
    }

    const chartsById = _.keyBy(chartItems, c => c.id)

    for (const ct of chartTags) {
        // XXX hardcoded filtering to public parent tags
        if ([1515, 1507, 1513, 1504, 1502, 1509, 1506, 1501, 1514, 1511, 1500, 1503, 1505, 1508, 1512, 1510].indexOf(ct.tagParentId) === -1)
            continue

        const c = chartsById[ct.chartId]
        if (c)
            c.tags.push({ id: ct.tagId, name: ct.tagName })
    }

    const client = algoliasearch(ALGOLIA_ID, ALGOLIA_SECRET_KEY)
    const index = client.initIndex('charts')

    index.setSettings({ attributeForDistinct: 'id' })

    const records = []
    for (const c of chartItems) {
        if (!c.tags) continue

        records.push({
            objectID: c.id,
            chartId: c.id,
            slug: c.slug,
            title: c.title,
            variantName: c.variantName,
            subtitle: c.subtitle,
            tagsText: c.tags.map((t: any) => t.name).join(" "),
            _tags: c.tags.map((t: any) => t.name),
            publishedAt: c.publishedAt,
            updatedAt: c.updatedAt,
            numDimensions: parseInt(c.numDimensions),
            titleLength: c.title.length
        })
    }
    
    await index.saveObjects(records)

    // for (let i = 0; i < records.length; i += 1000) {
    //     console.log(i)
    //     await index.saveObjects(records.slice(i, i+1000))
    // }

    db.end()
}

indexChartsToAlgolia()