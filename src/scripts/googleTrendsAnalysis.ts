import * as wpdb from '../articles/wpdb'
import * as fs from 'fs-extra'
const googleTrends = require('google-trends-api')

async function main() {
    /*await wpdb.connect()
    const categories = await wpdb.getEntriesByCategory()
    const titles = []
    for (const category of categories) {
        for (const entry of category.entries) {
            titles.push(entry.title)
        }
    }

    const data = []
    for (const title of titles) {
        const related = await googleTrends.relatedQueries({ keyword: title })
        console.log(related)
        data.push(related)
    }
    console.log(data)

    await wpdb.end()*/

    const file = await fs.readFile("/Users/mispy/tmp/trends.json", "utf8")
    const queries = JSON.parse(file)
    for (const query of queries) {
        console.log(JSON.stringify(query.default.rankedList[0].rankedKeyword.map((v: any) => `${v.query} ${v.value}`)))
    }
}

main()