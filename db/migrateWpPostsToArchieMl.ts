// WIP: Script to export the data_values for all variables attached to charts

import * as db from "./db.js"
import _, * as lodash from "lodash"
import * as cheerio from "cheerio"

import {
    EnrichedBlockImage,
    OwidEnrichedArticleBlock,
    EnrichedBlockPullQuote,
    EnrichedBlockText,
    Span,
    SpanSimpleText,
    EnrichedBlockHeading,
    EnrichedBlockChart,
    EnrichedBlockHtml,
    EnrichedBlockList,
    OwidArticleContent,
    OwidArticlePublicationContext,
    OwidArticleType,
} from "@ourworldindata/utils"
import * as Post from "./model/Post.js"
import { match, P } from "ts-pattern"
import { cheerioToSpan, spansToHtmlString } from "./gdocUtils.js"
import { join, result } from "lodash"
import fs from "fs"
// Note: all of this code is heavvy WIP - please ignore it for now

// function mapCheerioChildren(
//     node: CheerioElement,
//     handler: (node: CheerioElement) => void
// ): void {
//     node.children?.forEach((child) => {
//         handler(child)
//         mapCheerioChildren(child, handler)
//     })
// }

// TODO: add context for per post stats and error message context

function unwrapNode(
    node: CheerioElement,
    $: CheerioStatic
): ArchieMlTransformationResult<OwidEnrichedArticleBlock> {
    const children = node.children.map((child) => cheerioToArchieML(child, $))
    return joinArchieMLTransformationResults(children)
}

type ErrorNames =
    | "blockquote content is not just text"
    | "too many figcaption elements"
    | "too many figcaption elements after archieml transform"
    | "too many figcaption elements after archieml transform"
    | "figcaption element is not structured text"
    | "unkown element tag"
    | "expected only plain text"
    | "exepcted a single plain text element, got more than one"
    | "exepcted a single plain text element, got zero"
    | "iframe without src"
    | "no img element in figure"
    | "iframe with src that is not a grapher"
    | "too many elements in figure"
    | "img without src"
    | "unexpected elements in p"
    | "unexpected elements in list item"
    | "ul without children"
    | "columns item needs to have 2 children"
interface ArchieMlTransformationError {
    name: ErrorNames

    details: string
}

interface ArchieMlTransformationResult<T> {
    errors: ArchieMlTransformationError[]
    content: T[]
}

function emptyArchieMLTransformationResult<
    T
>(): ArchieMlTransformationResult<T> {
    return { errors: [], content: [] }
}

function joinArchieMLTransformationResults<T>(
    results: ArchieMlTransformationResult<T>[]
): ArchieMlTransformationResult<T> {
    const errors = lodash.flatten(results.map((r) => r.errors))
    const content = lodash.flatten(results.map((r) => r.content))
    return { errors, content }
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

function getSimpleSpans(spans: Span[]): [SpanSimpleText[], Span[]] {
    return _.partition(
        spans,
        (span: Span): span is SpanSimpleText =>
            span.spanType === "span-simple-text"
    )
}

function getSimpleTextSpansFromChildren(
    node: CheerioElement,
    $: CheerioStatic
): ArchieMlTransformationResult<SpanSimpleText> {
    const childElements = joinArchieMLTransformationResults(
        node.children.map((child) => cheerioToArchieML(child, $))
    )
    // TODO: put this in place again
    // const cleanedChildElements = consolidateSpans(
    //     childElements.content
    // )
    if (
        childElements.content.length !== 1 ||
        childElements.content[0].type !== "text"
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
    const [simpleSpans, otherSpans] = getSimpleSpans(
        childElements.content[0].value
    )
    const errors =
        otherSpans.length === 0
            ? childElements.errors
            : [
                  ...childElements.errors,
                  {
                      name: "expected only plain text" as const,
                      details: `suppressed tags: ${otherSpans.join(", ")}`,
                  },
              ]
    return {
        errors: errors,
        content: simpleSpans,
    }
}

type CheerioSequenceParserResult = {
    result: ArchieMlTransformationResult<OwidEnrichedArticleBlock>
    success: boolean
    remainingNodes: CheerioElement[]
}

type CheerioSequenceParser = (
    nodes: CheerioElement[]
) => CheerioSequenceParserResult

// function tryParseCommentTagPair(
//     nodes: CheerioElement[],
//     commentTag: string,
//     $: CheerioStatic,
//     contentParseFn: (
//         nodes: OwidEnrichedArticleBlock[]
//     ) => ArchieMlTransformationResult<OwidEnrichedArticleBlock>
// ): CheerioSequenceParser {
//     const currentNode = nodes[0]
//     if (currentNode.type === "comment") {
//         // if (remainingNodes[0].data?.trim().startsWith(stopAtComment))
//         //     return {
//         //         result: joinArchieMLTransformationResults(items),
//         //         remainingNodes: remainingNodes.slice(1),
//         //     }
//         if (currentNode.data?.trim().startsWith(commentTag)) {
//             const content = cheerioListToArchieML(
//                 nodes.slice(1),
//                 `/${commentTag}`,
//                 $
//             )
//             return {
//                 result: contentParseFn(content.result.content),
//                 remainingNodes: content.remainingNodes,
//             }
//         } else
//             return {
//                 result: { content: [], errors: [] },
//                 remainingNodes: nodes,
//             }
//     } else
//         return {
//             result: { content: [], errors: [] },
//             remainingNodes: nodes,
//         }
// }

// function cheerioListToArchieML(
//     nodes: CheerioElement[],
//     stopAtComment: string,
//     $: CheerioStatic
// ): CheerioSequenceParser {
//     let remainingNodes = [...nodes]
//     const items: ArchieMlTransformationResult<OwidEnrichedArticleBlock>[] = []
//     while (remainingNodes.length > 0) {
//         const currentNode = remainingNodes[0]

//         if (currentNode.type === "comment") {
//             if (remainingNodes[0].data?.trim().startsWith(stopAtComment))
//                 return {
//                     result: joinArchieMLTransformationResults(items),
//                     remainingNodes: remainingNodes.slice(1),
//                 }
//             tryParseCommentTagPair(
//                 remainingNodes,
//                 "wp:comment",
//                 $,
//                 (content) => {
//                     const errors: ArchieMlTransformationError[] =
//                         content.result.content.length !== 2
//                             ? [
//                                   {
//                                       name: "columns item needs to have 2 children" as const,
//                                       details: `Got ${content.result.content.length} children inside a columns structure`,
//                                   },
//                               ]
//                             : []

//                     const result = {
//                         content: [
//                             {
//                                 type: "sticky-right",
//                                 left: content.result.content[0],
//                                 right: content.result.content[1],
//                             },
//                         ],
//                         errors,
//                     }
//                     return result
//                 }
//             )
//         } else {
//             const currentNodeConverted = cheerioToArchieML(currentNode, $)
//             items.push(currentNodeConverted)
//             remainingNodes = remainingNodes.slice(1)
//         }
//     }
//     return {
//         result: joinArchieMLTransformationResults(items),
//         remainingNodes: [],
//     }
// }

function succeed(): CheerioSequenceParser {
    return (nodes: CheerioElement[]) => ({
        result: { errors: [], content: [] },
        remainingNodes: [],
        success: true,
    })
}

function fail(): CheerioSequenceParser {
    return (nodes: CheerioElement[]) => ({
        result: { errors: [], content: [] },
        remainingNodes: [],
        success: false,
    })
}

function seq(parsers: CheerioSequenceParser[]): CheerioSequenceParser {
    return (nodes: CheerioElement[]) => {
        const results: ArchieMlTransformationResult<OwidEnrichedArticleBlock>[] =
            []
        let remainingNodes = nodes
        for (const parser of parsers) {
            const result = parser(remainingNodes)
            if (!result.success)
                return {
                    result: joinArchieMLTransformationResults(results),
                    remainingNodes: nodes, // don't consume anything if we fail
                    success: false,
                }
            remainingNodes = result.remainingNodes
            results.push(result.result)
        }
        return {
            result: joinArchieMLTransformationResults(results),
            remainingNodes: remainingNodes,
            success: true,
        }
    }
}

function anyOf(parsers: CheerioSequenceParser[]): CheerioSequenceParser {
    return (nodes: CheerioElement[]) => {
        for (const parser of parsers) {
            const result = parser(nodes)
            if (result.success) {
                return result
            }
        }
        return {
            result: joinArchieMLTransformationResults([]),
            remainingNodes: nodes,
            success: false,
        }
    }
}

function many0(parser: CheerioSequenceParser): CheerioSequenceParser {
    return (nodes: CheerioElement[]) => {
        let result: CheerioSequenceParserResult = parser(nodes)
        const results: ArchieMlTransformationResult<OwidEnrichedArticleBlock>[] =
            []
        while (result.success) {
            results.push(result.result)
            result = parser(result.remainingNodes)
        }
        return {
            result: joinArchieMLTransformationResults(results),
            remainingNodes: result.remainingNodes,
            success: true,
        }
    }
}

function many1(parser: CheerioSequenceParser): CheerioSequenceParser {
    return (nodes: CheerioElement[]) => {
        let result: CheerioSequenceParserResult = parser(nodes)
        let atLeastOneConsumed = false
        const results: ArchieMlTransformationResult<OwidEnrichedArticleBlock>[] =
            []
        while (result.success) {
            results.push(result.result)
            result = parser(result.remainingNodes)
            atLeastOneConsumed = true
        }
        return {
            result: joinArchieMLTransformationResults(results),
            remainingNodes: result.remainingNodes,
            success: atLeastOneConsumed,
        }
    }
}

function manyTill(
    manyParser: CheerioSequenceParser,
    stopParser: CheerioSequenceParser
): CheerioSequenceParser {
    return (nodes: CheerioElement[]) => {
        let remainingNodes = nodes
        let stopResult: CheerioSequenceParserResult = stopParser(nodes)
        const results: ArchieMlTransformationResult<OwidEnrichedArticleBlock>[] =
            []
        while (!stopResult.success && remainingNodes) {
            const manyResult = manyParser(remainingNodes)
            if (!manyResult.success)
                return {
                    result: emptyArchieMLTransformationResult(),
                    remainingNodes: nodes,
                    success: false,
                }

            results.push(manyResult.result)
            remainingNodes = manyResult.remainingNodes
            stopResult = stopParser(remainingNodes)
            // we don't want to consume the content matched by stopParser, just make sure it
            // would apply successfully
        }
        return {
            result: joinArchieMLTransformationResults(results),
            remainingNodes: remainingNodes,
            success: stopResult.success,
        }
    }
}

function delimited(
    startParser: CheerioSequenceParser,
    elementListParser: CheerioSequenceParser,
    endParser: CheerioSequenceParser
): CheerioSequenceParser {
    return (nodes: CheerioElement[]) => {
        let result = startParser(nodes)
        if (result.success) {
            result = manyTill(
                elementListParser,
                endParser
            )(result.remainingNodes)
            return result
        }
        return {
            result: emptyArchieMLTransformationResult(),
            remainingNodes: result.remainingNodes,
            success: result.success,
        }
    }
}

function condition(
    predicate: (node: CheerioElement) => boolean
): CheerioSequenceParser {
    return (nodes: CheerioElement[]) => {
        if (nodes.length > 0 && predicate(nodes[0]))
            return {
                result: {
                    content: [],
                    errors: [],
                },
                remainingNodes: nodes.slice(1),
                success: true,
            }
        else
            return {
                result: {
                    content: [],
                    errors: [],
                },
                remainingNodes: nodes,
                success: false,
            }
    }
}

function wpComponent(
    name: string,
    contentParser: CheerioSequenceParser
): CheerioSequenceParser {
    return delimited(
        condition(
            (node) =>
                node.type === "comment" &&
                (node.data?.trim()?.startsWith(name) ?? false)
        ),
        contentParser,
        condition(
            (node) =>
                node.type === "comment" &&
                (node.data?.trim().startsWith(`/${name}`) ?? false)
        )
    )
}

function lazy(parser: () => CheerioSequenceParser) {
    let p: CheerioSequenceParser | undefined = undefined
    if (!p) p = parser()
    return p
}

function nonCommentParser(): CheerioSequenceParser {
    return (nodes: CheerioElement[]) => {
        if (nodes.length === 0)
            return {
                result: emptyArchieMLTransformationResult(),
                success: false,
                remainingNodes: nodes,
            }
        else {
            const parsedItem = cheerioToArchieML(nodes[0])
            return {
                result: parsedItem,
                remainingNodes: nodes.slice(1),
                success: true,
            }
        }
    }
}

function htmlElementParser(): CheerioSequenceParser {
    return anyOf([
        wpComponent(
            "columns",
            seq([
                wpComponent("column", lazy(htmlElementParser)),
                wpComponent("column", lazy(htmlElementParser)),
            ])
        ),
        condition((node) => node.type === "comment"),
        nonCommentParser(),
    ])
}

function htmlParser(): CheerioSequenceParser {
    return many0(htmlElementParser())
}

function cheerioToArchieML(
    node: CheerioElement,
    $: CheerioStatic
): ArchieMlTransformationResult<OwidEnrichedArticleBlock> {
    if (node.type === "comment") return { errors: [], content: [] }

    const unwrapNodeWithContext = (node: CheerioElement) => unwrapNode(node, $)

    const span = cheerioToSpan(node)
    if (span)
        return {
            errors: [],
            // TODO: below should be a list of spans and a rich text block
            content: [{ type: "text", value: [span], parseErrors: [] }],
        }
    else if (node.type === "tag") {
        const result: ArchieMlTransformationResult<OwidEnrichedArticleBlock> =
            match(node)
                .with({ tagName: "address" }, unwrapNodeWithContext)
                .with(
                    { tagName: "blockquote" },
                    (): ArchieMlTransformationResult<EnrichedBlockPullQuote> => {
                        const spansResult = getSimpleTextSpansFromChildren(
                            node,
                            $
                        )

                        return {
                            errors: spansResult.errors,
                            content: [
                                {
                                    type: "pull-quote",
                                    // TODO: this is incomplete - needs to match to all text-ish elements like StructuredText
                                    text: spansResult.content,
                                    parseErrors: [],
                                },
                            ],
                        }
                    }
                )
                .with({ tagName: "body" }, unwrapNodeWithContext)
                .with({ tagName: "center" }, unwrapNodeWithContext) // might want to translate this to a block with a centered style?
                .with({ tagName: "details" }, unwrapNodeWithContext)
                .with({ tagName: "div" }, unwrapNodeWithContext)
                .with({ tagName: "figcaption" }, unwrapNodeWithContext)
                .with(
                    { tagName: "figure" },
                    (): ArchieMlTransformationResult<EnrichedBlockImage> => {
                        const errors: ArchieMlTransformationError[] = []
                        const [figcaptionChildren, otherChildren] = _.partition(
                            node.children,
                            (n) => n.tagName === "figcaption"
                        )
                        let figcaptionElement: EnrichedBlockText | undefined =
                            undefined
                        if (figcaptionChildren.length > 1) {
                            errors.push({
                                name: "too many figcaption elements",
                                details: `Found ${figcaptionChildren.length} elements`,
                            })
                        } else {
                            const figCaption =
                                figcaptionChildren.length > 0
                                    ? cheerioToArchieML(
                                          figcaptionChildren[0],
                                          $
                                      )
                                    : undefined
                            if (figCaption)
                                if (figCaption.content.length > 1)
                                    errors.push({
                                        name: "too many figcaption elements after archieml transform",
                                        details: `Found ${figCaption.content.length} elements after transforming to archieml`,
                                    })
                                else {
                                    const element = figCaption.content[0]
                                    if (element?.type === "text")
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
                                name: "no img element in figure",
                                details: `Found ${otherChildren.length} elements`,
                            })
                        }

                        if (otherChildren.length > 1)
                            errors.push({
                                name: "too many elements in figure",
                                details: `Found ${otherChildren.length} elements`,
                            })

                        return {
                            errors,
                            content: [
                                {
                                    type: "image",
                                    src: image?.attribs.src ?? "",
                                    caption: figcaptionElement?.value ?? [],
                                    parseErrors: [],
                                },
                            ],
                        }
                    }
                )
                .with(
                    { tagName: P.union("h1", "h2", "h3", "h4", "h5", "h6") },
                    (): ArchieMlTransformationResult<EnrichedBlockHeading> => {
                        const level = parseInt(node.tagName.slice(1))
                        const spansResult = getSimpleTextSpansFromChildren(
                            node,
                            $
                        )
                        const errors = spansResult.errors
                        if (spansResult.content.length > 1)
                            errors.push({
                                name: "exepcted a single plain text element, got more than one" as const,
                                details: `Found ${spansResult.content.length} elements after transforming to archieml`,
                            })
                        if (spansResult.content.length == 0)
                            errors.push({
                                name: "exepcted a single plain text element, got zero" as const,
                                details: `Found ${spansResult.content.length} elements after transforming to archieml`,
                            })
                        return {
                            errors: spansResult.errors,
                            content: [
                                {
                                    type: "heading",
                                    level: level,
                                    text: spansResult.content[0],
                                    parseErrors: [],
                                },
                            ],
                        }
                    }
                )
                .with(
                    { tagName: "iframe" },
                    (): ArchieMlTransformationResult<EnrichedBlockChart> => {
                        const src = node.attribs.src
                        const errors: ArchieMlTransformationError[] = []
                        if (!src)
                            errors.push({
                                name: "iframe without src" as const,
                                details: `Found iframe without src attribute`,
                            })
                        if (
                            !src?.startsWith(
                                "https://ourworldindata.org/grapher/"
                            )
                        )
                            errors.push({
                                name: "iframe with src that is not a grapher",
                                details: `Found iframe with src that is not a grapher`,
                            })
                        return {
                            errors: errors,
                            content: [
                                {
                                    type: "chart",
                                    url: src,
                                    parseErrors: [],
                                },
                            ],
                        }
                    }
                )
                .with(
                    { tagName: "img" },
                    (): ArchieMlTransformationResult<EnrichedBlockImage> => {
                        const src = node.attribs.src
                        const errors: ArchieMlTransformationError[] = []
                        if (!src)
                            errors.push({
                                name: "img without src" as const,
                                details: `Found img without src attribute`,
                            })
                        return {
                            errors: errors,
                            content: [
                                {
                                    type: "image",
                                    src: src,
                                    caption: [],
                                    parseErrors: [],
                                },
                            ],
                        }
                    }
                )
                .with(
                    { tagName: "p" },
                    (): ArchieMlTransformationResult<EnrichedBlockText> => {
                        const children = joinArchieMLTransformationResults(
                            node.children.map((child) =>
                                cheerioToArchieML(child, $)
                            )
                        )
                        const [textChildren, otherChildren] = _.partition(
                            children.content,
                            (child): child is EnrichedBlockText =>
                                child.type === "text"
                        )
                        const errors = children.errors
                        if (otherChildren.length > 0)
                            errors.push({
                                name: "unexpected elements in p",
                                details: `Found ${otherChildren.length} elements`,
                            })
                        return {
                            errors: errors,
                            content: [
                                {
                                    type: "text",
                                    value: textChildren.flatMap(
                                        (child) => child.value
                                    ),
                                    parseErrors: [],
                                },
                            ],
                        }
                    }
                )
                .with(
                    { tagName: "ul" },
                    (): ArchieMlTransformationResult<EnrichedBlockList> => {
                        const children = node.children?.flatMap((child) => {
                            const grandChildren = child.children?.map(
                                (grandchild) => cheerioToArchieML(grandchild, $)
                            )
                            if (grandChildren)
                                return [
                                    joinArchieMLTransformationResults(
                                        grandChildren
                                    ),
                                ]
                            else return []
                        })

                        if (!children)
                            return {
                                errors: [
                                    {
                                        name: "ul without children" as const,
                                        details: `Found ul without children`,
                                    },
                                ],
                                content: [],
                            }

                        const handleListChildren = (
                            listContent: ArchieMlTransformationResult<OwidEnrichedArticleBlock>
                        ): ArchieMlTransformationResult<EnrichedBlockText> => {
                            const [textChildren, otherChildren] = _.partition(
                                listContent.content,
                                (child): child is EnrichedBlockText =>
                                    child.type === "text"
                            )
                            const errors = listContent.errors
                            if (otherChildren.length > 0)
                                errors.push({
                                    name: "unexpected elements in list item",
                                    details: `Found ${otherChildren.length} elements`,
                                })
                            return {
                                errors: errors,
                                content: [
                                    {
                                        type: "text",
                                        value: textChildren.flatMap(
                                            (child) => child.value
                                        ),
                                        parseErrors: [],
                                    },
                                ],
                            }
                        }

                        const listChildren = joinArchieMLTransformationResults(
                            children.map(handleListChildren)
                        )
                        return {
                            errors: listChildren.errors,
                            content: [
                                {
                                    type: "list",
                                    items: listChildren.content,
                                    parseErrors: [],
                                },
                            ],
                        }
                    }
                )
                .with(
                    { tagName: P.union("svg", "table", "video") },
                    (): ArchieMlTransformationResult<EnrichedBlockHtml> => {
                        return {
                            errors: [],
                            content: [
                                {
                                    type: "html",
                                    value: $.html(node) ?? "",
                                    parseErrors: [],
                                },
                            ],
                        }
                    }
                )
                // TODO: this is missing a lot of html tags still
                .otherwise(() => ({ errors: [], content: [] }))
        return result
    } else
        return {
            errors: [
                {
                    name: "unkown element tag",
                    details: `type was ${node.type}`,
                },
            ],
            content: [],
        }
}

const migrate = async (): Promise<void> => {
    const writeToFile = false
    await db.getConnection()

    const posts = await Post.select(
        "id",
        "slug",
        "title",
        "content",
        "published_at",
        "updated_at"
    ).from(db.knexTable(Post.postsTable)) //.where("id", "=", "54652"))

    // const tagCounts = new Map<string, number>()

    for (const post of posts) {
        const $: CheerioStatic = cheerio.load(post.content)
        const bodyContents = $("body").contents().toArray()
        const archieMlBodyElements = cheerioListToArchieML(bodyContents, $)
            .map((block) => ({
                ...block,
                content: block.content.filter(
                    (element) =>
                        element.type !== "text" ||
                        (element.value.length > 0 &&
                            element.value.some(
                                (span) =>
                                    span.spanType !== "span-simple-text" ||
                                    span.text.trim() !== ""
                            ))
                ),
            }))
            .filter(
                (block) => block.content.length > 0 || block.errors.length > 0
            )
        const archieMlBlocks = archieMlBodyElements.flatMap(
            (block) => block.content
        )
        const errors = archieMlBodyElements.flatMap((block) => block.errors)
        // archieMlForPosts.push([
        //     post.id,
        //     JSON.stringify(archieMlBlocks, null, 2),
        //     JSON.stringify(errors, null, 2),
        // ])

        const archieMlFieldContent: OwidArticleType = {
            id: `wp-${post.id}`,
            slug: post.slug,
            content: {
                body: archieMlBlocks,
                title: post.title,
                byline: "todo", // TOOD: fetch authors from WP and store them in posts table
                dateline: post.published_at?.toISOString() ?? "",
            },
            published: false, // post.published_at !== null,
            createdAt: post.updated_at, // TODO: this is wrong but it doesn't seem we have a created date in the posts table
            publishedAt: null, // post.published_at,
            updatedAt: null, // post.updated_at,
            publicationContext: OwidArticlePublicationContext.listed,
        }
        const archieMlStatsContent = {
            errors,
            numErrors: errors.length,
            numBlocks: archieMlBlocks.length,
        }

        const insertQuery = `
        UPDATE posts SET archieml = ?, archieml_update_statistics = ? WHERE id = ?
        `
        await db.queryMysql(insertQuery, [
            JSON.stringify(archieMlFieldContent, null, 2),
            JSON.stringify(archieMlStatsContent, null, 2),
            post.id,
        ])
        console.log("inserted", post.id)

        if (writeToFile) {
            try {
                fs.writeFileSync(
                    `./wpmigration/${post.slug}.html`,
                    post.content
                )
                // file written successfully
            } catch (err) {
                console.error(err)
            }
            const parsedJson = JSON.stringify(archieMlBodyElements, null, 2)
            try {
                fs.writeFileSync(`./wpmigration/${post.slug}.json`, parsedJson)
                // file written successfully
            } catch (err) {
                console.error(err)
            }
        }
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
