import * as wpdb from "db/wpdb"
import * as fs from "fs-extra"
import { csvRow } from "utils/server/serverUtil"
const googleTrends = require("google-trends-api")
const asciify = require("asciify-string")

async function getTitles() {
    await wpdb.connect()

    const pageRows = await wpdb.query(`
        SELECT post_title FROM wp_posts AS posts
        WHERE (posts.post_type='page' OR posts.post_type='post') AND posts.post_status='publish' ORDER BY post_title DESC
    `)

    await wpdb.end()

    return pageRows.map(row => asciify(row.post_title))
}

async function main() {
    const trendsPath = "/tmp/trends.json"

    let data: { [key: string]: any } = {}

    // Only fetch for queries we don't already have
    if (fs.pathExistsSync(trendsPath)) {
        data = JSON.parse(await fs.readFile("/tmp/trends.json", "utf8"))
    }

    const titles = await getTitles()
    for (const title of titles) {
        if (title in data) continue

        console.log(title)

        try {
            const related = await googleTrends.relatedQueries({
                keyword: title
            })
            data[title] = related
        } catch (err) {
            data[title] = JSON.stringify({})
            console.error(err)
        }

        await fs.writeFile("/tmp/trends.json", JSON.stringify(data))
    }

    console.log("DONE")

    const rows: string[][] = [[]]
    let i = 0
    for (const title in data) {
        const datum = JSON.parse(data[title])
        if (
            datum &&
            datum.default &&
            datum.default.rankedList[0].rankedKeyword.length
        ) {
            rows[0][i] = title
            // const ranked = datum.default.rankedList[0].rankedKeyword.map((v: any) => `${v.value} ${v.query}`)
            let j = 1
            for (const keyword of datum.default.rankedList[0].rankedKeyword) {
                if (!rows[j]) rows[j] = []
                rows[j][i] = `${keyword.value} ${keyword.query}`
                j += 1
            }
            i += 1
        }
    }

    let csv = ""
    for (const row of rows) {
        csv += csvRow(row)
    }

    await fs.writeFile("/tmp/trends.csv", csv)
}

main()
