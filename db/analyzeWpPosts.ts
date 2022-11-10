// Script to export the data_values for all variables attached to charts

import * as db from "./db.js"
import _ from "lodash"
import * as cheerio from "cheerio"

// const argv = parseArgs(process.argv.slice(2))

export function traverseNode(
    node: CheerioElement,
    depth: number,
    isFilterActive: boolean,
    decideFilter: (elem: CheerioElement) => boolean,
    handler: (
        elem: CheerioElement,
        depth: number,
        isFilterActive: boolean
    ) => void
): void {
    handler(node, depth, isFilterActive)
    const filterActive = isFilterActive || decideFilter(node)
    node.children?.forEach((elem) =>
        traverseNode(elem, depth + 1, filterActive, decideFilter, handler)
    )
}

const analyze = async (): Promise<void> => {
    await db.getConnection()

    const posts: { id: number; content: string }[] = await db.queryMysql(`
        SELECT id, content from posts where type<>'wp_block'
    `)

    const tagCounts = new Map<string, number>()
    const decideFilter = (node: CheerioElement): boolean =>
        node.type === "tag" && node.tagName === "iframe"

    for (const post of posts) {
        // temp workaround for load with 3 params not showing up in TS type
        const $: CheerioStatic = cheerio.load(post.content)
        $("body").each((i, node) => {
            traverseNode(
                node,
                1,
                false,
                decideFilter,
                (elem, depth, isFilterActive) => {
                    if (isFilterActive) {
                        const tagName =
                            elem.type !== "tag"
                                ? `${elem.type} - depth ${depth}`
                                : elem.tagName
                        const currentCount = tagCounts.get(tagName) ?? 0
                        tagCounts.set(tagName, currentCount + 1)
                    }
                }
            )
        })
    }

    const sortedTagCount = _.sortBy(
        Array.from(tagCounts.entries()),
        ([tag, _]) => tag
    )
    for (const [tag, count] of sortedTagCount) {
        console.log(`${tag}: ${count}`)
    }

    await db.closeTypeOrmAndKnexConnections()
}

analyze()
