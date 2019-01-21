import * as algoliasearch from 'algoliasearch'
import * as _ from 'lodash'
const chunk = require('chunk-text')

import * as wpdb from 'db/wpdb'
import { ALGOLIA_ID  } from 'settings'
import { ALGOLIA_SECRET_KEY } from 'serverSettings'
import { formatPost } from 'site/server/formatting'

async function indexToAlgolia() {
    const client = algoliasearch(ALGOLIA_ID, ALGOLIA_SECRET_KEY)
    const index = client.initIndex('mispydev_owid_articles');

    index.setSettings({ attributeForDistinct: 'slug' })
    return

    const rows = await wpdb.query(`SELECT ID, post_name, post_title, post_content FROM wp_posts WHERE (post_type='post' OR post_type='page') AND post_status='publish'`)

    const records = []

    /*for (const row of rows) {
        const post = await formatPost(await wpdb.getFullPost(row), {})
        const chunks = chunk(post.plaintext, 1000);

        let i = 0
        for (const c of chunks) {
            records.push({
                objectID: `${row.ID}-c${i}`,
                slug: row.post_name,
                title: row.post_title,
                content: c
            })
            i += 1
        }
    }

    await index.saveObjects(records)*/
    
    // for (let i = 0; i < records.length; i += 1000) {
    //     console.log(i)
    //     await index.saveObjects(records.slice(i, i+1000))
    // }

    wpdb.end()
}

indexToAlgolia()