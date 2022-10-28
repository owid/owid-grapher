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
import {
    BlockPullQuote,
    BlockText,
    OwidArticleBlock,
    OwidArticleContent,
    Span,
    SpanLink,
    SpanBold,
    SpanItalic,
    SpanNewline,
    SpanQuote,
    SpanSubscript,
    SpanSuperscript,
    SpanText,
    SpanUnderline,
    SpanFallback,
} from "../clientUtils/owidTypes.js"
import { match } from "ts-pattern"

// const argv = parseArgs(process.argv.slice(2))

// function traverseNode(
//     node: CheerioElement,
//     depth: number,
//     handler: (elem: CheerioElement, depth: number) => void
// ): void {
//     handler(node, depth)
//     node.children?.forEach((elem) => traverseNode(elem, depth + 1, handler))
// }

function mapCheerioChildren(
    node: CheerioElement,
    handler: (node: CheerioElement) => void
): void {
    node.children?.forEach((child) => {
        handler(child)
        mapCheerioChildren(child, handler)
    })
}

function spanFallback(node: CheerioElement): SpanFallback {
    return {
        type: "span-fallback",
        children: _.compact(node.children?.map(projectToSpan)) ?? [],
    }
}

function projectToSpan(node: CheerioElement): Span | undefined {
    if (node.type === "comment") return undefined
    else if (node.type === "text")
        return { type: "span-text", text: node.data ?? "" }
    else if (node.type === "tag") {
        return match(node.tagName)
            .with("a", (): SpanLink => {
                const url = node.attribs.href
                const children =
                    _.compact(node.children?.map(projectToSpan)) ?? []
                return { type: "span-link", children, url }
            })
            .with("b", (): SpanBold => {
                const children =
                    _.compact(node.children?.map(projectToSpan)) ?? []
                return { type: "span-bold", children }
            })
            .with("i", (): SpanItalic => {
                const children =
                    _.compact(node.children?.map(projectToSpan)) ?? []
                return { type: "span-italic", children }
            })
            .with("br", (): Span => ({ type: "span-newline" }))
            .with("cite", () => spanFallback(node))
            .with("code", () => spanFallback(node))
            .otherwise(() => undefined)
    }
    return undefined
}

function unwrapNode(node: CheerioElement): OwidArticleBlock[] {
    return [...node.children.flatMap(projectToArchieML)]
}

function projectToArchieML(node: CheerioElement): OwidArticleBlock[] {
    if (node.type === "comment") return []
    else if (node.type === "text")
        return [{ type: "text", value: node.data ?? "" }]
    else if (node.type === "tag") {
        const content: OwidArticleBlock[] = match(node.tagName)
            .with("address", unwrapNode)
            .with("blockquote", (): BlockPullQuote[] => [
                {
                    type: "pull-quote",
                    // TODO: this is incomplete - needs to match to all text-ish elements like StructuredText
                    value: node.children
                        .flatMap(projectToArchieML)
                        .filter(
                            (item): item is BlockText => item.type === "text"
                        )
                        .map((item) => item.value),
                },
            ])
            .with("body", unwrapNode)
            .with("center", unwrapNode) // might want to translate this to a block with a centered style?

            .otherwise(() => [])
        return content
    }
    return []
}

const migrate = async (): Promise<void> => {
    await db.getConnection()

    const posts: { id: number; content: string }[] = await db.queryMysql(`
        SELECT id, content from posts where type<>'wp_block' limit 1
    `)

    const tagCounts = new Map<string, number>()

    for (const post of posts) {
        const $: CheerioStatic = cheerio.load(post.content)
        const archieMlBodyElements = $("body")
            .toArray()
            .flatMap(projectToArchieML)
        console.log(archieMlBodyElements)
    }

    // const sortedTagCount = _.sortBy(
    //     Array.from(tagCounts.entries()),
    //     ([tag, count]) => tag
    // )
    // for (const [tag, count] of sortedTagCount) {
    //     console.log(`${tag}: ${count}`)
    // }

    await db.closeTypeOrmAndKnexConnections()
}

migrate()
