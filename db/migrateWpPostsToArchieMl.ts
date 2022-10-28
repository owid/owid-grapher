// Script to export the data_values for all variables attached to charts

import * as db from "./db.js"
import _, * as lodash from "lodash"
import parseArgs from "minimist"
import * as cheerio from "cheerio"

import {
    GRAPHER_DB_NAME,
    GRAPHER_DB_USER,
    GRAPHER_DB_PASS,
    GRAPHER_DB_HOST,
    GRAPHER_DB_PORT,
} from "../settings/serverSettings.js"

// const argv = parseArgs(process.argv.slice(2))

function traverseNode(
    node: CheerioElement,
    depth: number,
    handler: (elem: CheerioElement, depth: number) => void
): void {
    handler(node, depth)
    node.children?.forEach((elem) => traverseNode(elem, depth + 1, handler))
}

const migrate = async (): Promise<void> => {
    await db.getConnection()

    const posts: { id: number; content: string }[] = await db.queryMysql(`
        SELECT id, content from posts where type<>'wp_block'
    `)

    const tagCounts = new Map<string, number>()

    for (const post of posts) {
        // temp workaround for load with 3 params not showing up in TS type
        const $: CheerioStatic = cheerio.load(post.content)
        $("body").each((i, node) => {
            traverseNode(node, 1, (elem, depth) => {
                const tagName =
                    elem.type !== "tag"
                        ? `${elem.type} - depth ${depth}`
                        : elem.tagName
                const currentCount = tagCounts.get(tagName) ?? 0
                tagCounts.set(tagName, currentCount + 1)
            })
        })
    }

    const sortedTagCount = _.sortBy(
        Array.from(tagCounts.entries()),
        ([tag, count]) => tag
    )
    for (const [tag, count] of sortedTagCount) {
        console.log(`${tag}: ${count}`)
    }

    await db.closeTypeOrmAndKnexConnections()
}

migrate()
