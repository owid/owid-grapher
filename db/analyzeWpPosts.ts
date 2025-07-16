import * as db from "./db.js"
import * as _ from "lodash-es"
import * as cheerio from "cheerio"
import type { AnyNode } from "domhandler"

// const argv = parseArgs(process.argv.slice(2))

export function traverseNode(
    node: AnyNode,
    depth: number,
    isFilterActive: boolean,
    decideFilter: (elem: AnyNode) => boolean,
    handler: (elem: AnyNode, depth: number, isFilterActive: boolean) => void
): void {
    handler(node, depth, isFilterActive)
    const filterActive = isFilterActive || decideFilter(node)

    if (!("children" in node)) return
    node.children.forEach((elem) =>
        traverseNode(elem, depth + 1, filterActive, decideFilter, handler)
    )
}

const analyze = async (): Promise<void> => {
    await db.knexReadonlyTransaction(async (trx): Promise<void> => {
        const posts: { id: number; content: string }[] = await db.knexRaw(
            trx,
            `
        SELECT id, content from posts where type<>'wp_block'
    `
        )

        const tagCounts = new Map<string, number>()
        const decideFilter = (node: AnyNode): boolean =>
            node.type === "tag" && node.tagName === "iframe"

        for (const post of posts) {
            // temp workaround for load with 3 params not showing up in TS type
            const $: cheerio.CheerioAPI = cheerio.load(post.content)
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
    }, db.TransactionCloseMode.Close)
}

void analyze()
