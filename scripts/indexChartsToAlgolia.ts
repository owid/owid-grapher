import * as algoliasearch from 'algoliasearch'
import * as _ from 'lodash'

import * as db from 'db/db'
import { ALGOLIA_ID } from 'settings'
import { ALGOLIA_SECRET_KEY } from 'serverSettings'
import { getIndexableCharts } from 'site/server/grapherUtil'

async function indexChartsToAlgolia() {
    const client = algoliasearch(ALGOLIA_ID, ALGOLIA_SECRET_KEY)
    const index = client.initIndex('mispydev_owid_charts')

    index.setSettings({ attributeForDistinct: 'id' })

    const chartItems = await getIndexableCharts()

    const records = []
    for (const c of chartItems) {
        records.push({
            objectID: c.id,
            slug: c.slug,
            title: c.title,
            _tags: c.tags.map(t => t.name)
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