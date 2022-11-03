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
    BlockStructuredText,
    BlockImage,
} from "@ourworldindata/utils"
import { match } from "ts-pattern"
import { traverseNode } from "./analyzeWpPosts.js"

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

// TODO: add context for per post stats and error message context

function projectToSpan(node: CheerioElement): Span | undefined {
    if (node.type === "text")
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
            .with("code", () => spanFallback(node)) // TODO: should get a style
            .with(
                "em",
                (): SpanItalic => ({
                    type: "span-italic",
                    children:
                        _.compact(node.children?.map(projectToSpan)) ?? [],
                })
            )

            .otherwise(() => {
                console.log("unhandled tag", node.tagName)
                return undefined
            })
    }
    return undefined
}

function unwrapNode(
    node: CheerioElement
): ArchieMlTransformationResult<OwidArticleBlock> {
    const children = node.children.map(projectToArchieML)
    return joinArchieMLTransformationResults(children)
}

interface ArchieMlTransformationError {
    name: string
    details: string
}

interface ArchieMlTransformationResult<T> {
    errors: ArchieMlTransformationError[]
    content: T[]
}

function joinArchieMLTransformationResults<T>(
    results: ArchieMlTransformationResult<T>[]
): ArchieMlTransformationResult<T> {
    const errors = lodash.flatten(results.map((r) => r.errors))
    const content = lodash.flatten(results.map((r) => r.content))
    return { errors, content }
}

function consolidateSpans(blocks: OwidArticleBlock[]) {
    const newBlocks: OwidArticleBlock[] = []
    let currentBlock: BlockStructuredText | undefined = undefined
    for (const block of blocks) {
        if (block.type === "structured-text")
            if (currentBlock === undefined) currentBlock = block
            else
                currentBlock = {
                    type: "structured-text",
                    value: [...currentBlock.value, ...block.value],
                }
        else {
            if (currentBlock !== undefined) {
                newBlocks.push(currentBlock)
                currentBlock = undefined
                newBlocks.push(block)
            }
        }
    }
    return newBlocks
}

function tempFlattenSpansToString(spans: Span[]): string {
    if (spans.length === 0) return ""
    else {
        const result = spans
            .map((span) =>
                match(span)
                    .with({ type: "span-text" }, (span) => span.text)
                    .with(
                        { type: "span-link" },
                        (span) =>
                            `<a href="${span.url}">${tempFlattenSpansToString(
                                span.children
                            )}</a>`
                    )
                    .with({ type: "span-newline" }, () => "</br>")
                    .with(
                        { type: "span-italic" },
                        (span) =>
                            `<i>${tempFlattenSpansToString(span.children)}</i>`
                    )
                    .with(
                        { type: "span-bold" },
                        (span) =>
                            `<b>${tempFlattenSpansToString(span.children)}</b>`
                    )
                    .with(
                        { type: "span-underline" },
                        (span) =>
                            `<u>${tempFlattenSpansToString(span.children)}</u>`
                    )
                    .with(
                        { type: "span-subscript" },
                        (span) =>
                            `<sub>${tempFlattenSpansToString(
                                span.children
                            )}</sub>`
                    )
                    .with(
                        { type: "span-superscript" },
                        (span) =>
                            `<sup>${tempFlattenSpansToString(
                                span.children
                            )}</sup>`
                    )
                    .with(
                        { type: "span-quote" },
                        (span) =>
                            `<q>${tempFlattenSpansToString(span.children)}</q>`
                    )
                    .with(
                        { type: "span-fallback" },
                        (span) =>
                            `<span>${tempFlattenSpansToString(
                                span.children
                            )}</span>`
                    )
                    .exhaustive()
            )
            .join("")
        return result
    }
}

function findRecursive(
    nodes: CheerioElement[],
    tagName: string
): CheerioElement | undefined {
    for (const node of nodes) {
        if (node.tagName === tagName) return node
        else {
            const result = findRecursive(node.children ?? [], tagName)
            if (result !== undefined) return result
        }
    }
    return undefined
}

function projectToArchieML(
    node: CheerioElement
): ArchieMlTransformationResult<OwidArticleBlock> {
    if (node.type === "comment") return { errors: [], content: [] }
    const span = projectToSpan(node)
    if (span)
        return {
            errors: [],
            content: [{ type: "structured-text", value: [span] }],
        }
    else if (node.type === "tag") {
        const result: ArchieMlTransformationResult<OwidArticleBlock> = match(
            node.tagName
        )
            .with("address", unwrapNode)
            .with(
                "blockquote",
                (): ArchieMlTransformationResult<BlockPullQuote> => {
                    const childElements = joinArchieMLTransformationResults(
                        node.children.map(projectToArchieML)
                    )
                    const cleanedChildElements = consolidateSpans(
                        childElements.content
                    )
                    if (
                        cleanedChildElements.length !== 1 ||
                        cleanedChildElements[0].type !== "structured-text"
                    )
                        return {
                            errors: [
                                {
                                    name: "blockquote content is not just text",
                                    details: ``,
                                },
                            ],
                            content: [],
                        }

                    return {
                        errors: [],
                        content: [
                            {
                                type: "pull-quote",
                                // TODO: this is incomplete - needs to match to all text-ish elements like StructuredText
                                value: [
                                    tempFlattenSpansToString(
                                        cleanedChildElements[0].value
                                    ),
                                ],
                            },
                        ],
                    }
                }
            )
            .with("body", unwrapNode)
            .with("center", unwrapNode) // might want to translate this to a block with a centered style?
            .with("details", unwrapNode)
            .with("div", unwrapNode)
            .with("figcaption", unwrapNode)
            .with("figure", (): ArchieMlTransformationResult<BlockImage> => {
                const errors: ArchieMlTransformationError[] = []
                const [figcaptionChildren, otherChildren] = _.partition(
                    node.children,
                    (n) => n.tagName === "figcaption"
                )
                let figcaptionElement: BlockStructuredText | undefined =
                    undefined
                if (figcaptionChildren.length > 1) {
                    errors.push({
                        name: "too many figcaption elements",
                        details: `Found ${figcaptionChildren.length} elements`,
                    })
                } else {
                    const figCaption =
                        figcaptionChildren.length > 0
                            ? projectToArchieML(figcaptionChildren[0])
                            : undefined
                    if (figCaption)
                        if (figCaption.content.length > 1)
                            errors.push({
                                name: "too many figcaption elements after archieml transform",
                                details: `Found ${figCaption.content.length} elements after transforming to archieml`,
                            })
                        else {
                            const element = figCaption.content[0]
                            if (element?.type === "structured-text")
                                figcaptionElement = element
                            else
                                errors.push({
                                    name: "figcaption element is not structured text",
                                    details: `Found ${element?.type} element after transforming to archieml`,
                                })
                        }
                }
                const image = findRecursive(otherChildren, "img")
                if (!image) {
                    // TODO: this is a legitimate case, there may be other content in a figure
                    // but for now we treat it as an error and see how often this error happens
                    errors.push({
                        name: "no image found in figure",
                        details: `Found ${otherChildren.length} elements`,
                    })
                }

                return {
                    errors,
                    content: [
                        {
                            type: "image",
                            value: {
                                src: image?.attribs.src ?? "",
                                caption: tempFlattenSpansToString(
                                    figcaptionElement?.value ?? []
                                ),
                            },
                        },
                    ],
                }
            })
            .otherwise(() => ({ errors: [], content: [] }))
        return result
    } else
        return {
            errors: [
                {
                    name: "unkown-element-tag",
                    details: `type was ${node.type}`,
                },
            ],
            content: [],
        }
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
