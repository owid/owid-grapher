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
    EnrichedBlockStickyRightContainer,
    EnrichedBlockNumberedList,
} from "@ourworldindata/utils"
import * as Post from "./model/Post.js"
import { match, P } from "ts-pattern"
import { cheerioToSpan } from "./model/Gdoc/htmlToEnriched.js"
import { partition } from "lodash"
import fs from "fs"
import { contents } from "cheerio/lib/api/traversing.js"
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
    | "expected only text inside heading"
    | "unexpected wp component tag"
    | "columns block expects 2 children"
    | "columns block expects children to be column components"
    | "ol without children"
    | "unhandled html tag found"
interface ArchieMlTransformationError {
    name: ErrorNames

    details: string
}

interface ArchieMlTransformationResult<T> {
    errors: ArchieMlTransformationError[]
    content: T[]
}

// type WpComponentTagNames =
//     | "column"
//     | "columns"

interface WpComponent {
    tagName: string
    attributes: Record<string, unknown> | undefined
    childrenResults: ArchieBlockOrWpComponent[]
}

type ArchieBlockOrWpComponent = OwidEnrichedArticleBlock | WpComponent

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

// TODO: do we still want to do this this way?
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
        !("type" in childElements.content[0]) ||
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

function getSpansFromChildren(
    node: CheerioElement,
    $: CheerioStatic
): ArchieMlTransformationResult<Span> {
    const childElements = joinArchieMLTransformationResults(
        node.children.map((child) => cheerioToArchieML(child, $))
    )

    const [textChildren, otherChildren] = partition(
        childElements.content,
        isEnrichedTextBlock
    )

    const spans = textChildren.flatMap((text) => text.value)

    const errors =
        spans.length === 0
            ? childElements.errors
            : [
                  ...childElements.errors,
                  {
                      name: "expected only text inside heading" as const,
                      details: `suppressed tags: ${otherChildren.join(", ")}`,
                  },
              ]
    return {
        errors: errors,
        content: spans,
    }
}

function unwrapNode(
    node: CheerioElement,
    $: CheerioStatic
): ArchieMlTransformationResult<ArchieBlockOrWpComponent> {
    const result = cheerioNodesToArchieML(node.children, $)
    return result
}

function isWpComponentStart(node: CheerioElement): boolean {
    return (
        node.type === "comment" &&
        (node.data?.trimStart()?.startsWith("wp:") ?? false)
    )
}

function isWpComponentEnd(node: CheerioElement): boolean {
    return (
        node.type === "comment" &&
        (node.data?.trimStart()?.startsWith("/wp:") ?? false)
    )
}

const wpTagRegex = /wp:(?<tag>\w+)\s*(?<attributes>.*)?/

function getWpComponentDetails(node: CheerioElement): WpComponent {
    const match = node.data?.match(wpTagRegex)
    if (!match) throw new Error("WpComponent could not match")
    const attributes =
        match.groups?.attributes && match.groups.attributes.trim() !== ""
            ? JSON.parse(match.groups?.attributes ?? "")
            : undefined
    return {
        tagName: match.groups!.tag!,
        attributes,
        childrenResults: [],
    }
}

interface ParseWpComponentResult {
    result: ArchieMlTransformationResult<ArchieBlockOrWpComponent>
    remainingNodes: CheerioElement[]
}

function checkIsWpComponentOfType(
    blockOrComponent: ArchieBlockOrWpComponent,
    expectedTagName: string
): WpComponent | undefined {
    return !("tagName" in blockOrComponent) ||
        blockOrComponent.tagName !== expectedTagName
        ? undefined
        : blockOrComponent
}

function finishWpComponent(
    details: WpComponent,
    content: ArchieMlTransformationResult<ArchieBlockOrWpComponent>
): ArchieMlTransformationResult<ArchieBlockOrWpComponent> {
    return match(details.tagName)
        .with(
            "column",
            (): ArchieMlTransformationResult<ArchieBlockOrWpComponent> => {
                return {
                    content: [
                        {
                            ...details,
                            childrenResults: content.content,
                        },
                    ],
                    errors: content.errors,
                }
            }
        )
        .with("columns", () => {
            const errors = content.errors
            if (content.content.length !== 2) {
                errors.push({
                    name: "columns block expects 2 children",
                    details: `Got ${content.content.length} children instead`,
                })
                return { ...content, errors }
            }
            const firstChild = checkIsWpComponentOfType(
                content.content[0],
                "column"
            )
            if (firstChild === undefined) {
                errors.push({
                    name: "columns block expects children to be column components",
                    details: `Got ${firstChild} child instead`,
                })
                return { ...content, errors }
            }
            const secondChild = checkIsWpComponentOfType(
                content.content[1],
                "column"
            )
            if (secondChild === undefined) {
                errors.push({
                    name: "columns block expects children to be column components",
                    details: `Got ${secondChild} child instead`,
                })
                return { ...content, errors }
            }
            return {
                errors,
                // TODO: damn - columsn contains one non-empty div which has a class
                // wp-block-columns. This one then contains the wp:column stuff.
                // The problem is that at the moment we collapse a list of results
                // into a single result quite often, e.g. for the divs and wp:column
                // nodes. This means that here we don't know anymore where the column
                // tags started and ended. We could eihter keep the full tree structure
                // around and only flatten at the very end or we could add a separator
                // placeholder element
                content: [
                    {
                        type: "sticky-right",
                        left: convertAllWpComponentsToArchieMLBlocks(
                            firstChild.childrenResults
                        ),
                        right: convertAllWpComponentsToArchieMLBlocks(
                            secondChild.childrenResults
                        ),
                        parseErrors: [],
                    } as EnrichedBlockStickyRightContainer,
                ],
            }
        })
        .with("paragraph", () => {
            return content
        })
        .otherwise(() => {
            return {
                errors: [
                    ...content.errors,
                    {
                        name: "unexpected wp component tag",
                        details: `Found unexpected tag ${details.tagName}`,
                    },
                ],
                content: content.content,
            }
        })
}

function convertAllWpComponentsToArchieMLBlocks(
    blocksOrComponents: ArchieBlockOrWpComponent[]
): OwidEnrichedArticleBlock[] {
    return blocksOrComponents.flatMap((blockOrComponent) => {
        if ("type" in blockOrComponent) return [blockOrComponent]
        else {
            return convertAllWpComponentsToArchieMLBlocks(
                blockOrComponent.childrenResults
            )
        }
    })
}

function parseWpComponent(
    nodes: CheerioElement[],
    $: CheerioStatic
): ParseWpComponentResult {
    const startNode = nodes[0]
    if (!isWpComponentStart(startNode))
        throw new Error(
            "Tried to start parsing a WP component on a non-comment block!"
        )
    const componentDetails = getWpComponentDetails(startNode)

    // TODO: advance one element at a time through nodes. If it is a wp component recurse and
    // on getting back updates nodes. If it is a normal element parse it with cheerioToAachieML.
    let remainingNodes = nodes.slice(1)
    const collectedContent: ArchieMlTransformationResult<ArchieBlockOrWpComponent>[] =
        []
    while (remainingNodes.length > 0) {
        const node = remainingNodes[0]
        if (isWpComponentEnd(node)) {
            const closingDetails = getWpComponentDetails(node)
            if (closingDetails.tagName !== componentDetails.tagName) {
                throw new Error(
                    `Found a closing tag (${closingDetails.tagName}) that did not match the expected open tag (${componentDetails.tagName})`
                )
            }
            const collectedChildren =
                joinArchieMLTransformationResults(collectedContent)

            return {
                result: finishWpComponent(
                    componentDetails,
                    withoutEmptyOrWhitespaceOnlyTextBlocks(collectedChildren)
                ),
                remainingNodes,
            }
        } else if (isWpComponentStart(node)) {
            const result = parseWpComponent(remainingNodes, $)
            remainingNodes = result.remainingNodes
            collectedContent.push(result.result)
        } else {
            const parsed = cheerioToArchieML(node, $)
            collectedContent.push(parsed)
            remainingNodes = remainingNodes.slice(1)
        }
    }
    throw new Error(
        `Tried parsing a WP component but never found a matching end tag for ${componentDetails.tagName}`
    )
}

function isEnrichedTextBlock(
    item: ArchieBlockOrWpComponent
): item is EnrichedBlockText {
    return "type" in item && item.type === "text"
}

function cheerioToArchieML(
    node: CheerioElement,
    $: CheerioStatic
): ArchieMlTransformationResult<ArchieBlockOrWpComponent> {
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
        const result: ArchieMlTransformationResult<ArchieBlockOrWpComponent> =
            match(node)
                .with({ tagName: "address" }, unwrapNodeWithContext)
                .with(
                    { tagName: "blockquote" },
                    (): ArchieMlTransformationResult<EnrichedBlockPullQuote> => {
                        const spansResult = getSimpleTextSpansFromChildren(
                            node, //bla
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
                    (): ArchieMlTransformationResult<ArchieBlockOrWpComponent> => {
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
                                    ? cheerioNodesToArchieML(
                                          figcaptionChildren,
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
                                    if (isEnrichedTextBlock(element))
                                        figcaptionElement = element
                                    else
                                        errors.push({
                                            name: "figcaption element is not structured text",
                                            details: `Found ${
                                                "type" in element
                                                    ? element.type
                                                    : ""
                                            } element after transforming to archieml`,
                                        })
                                }
                        }
                        if (otherChildren.length > 1)
                            errors.push({
                                name: "too many elements in figure",
                                details: `Found ${otherChildren.length} elements`,
                            })
                        const image = findRecursive(otherChildren, "img")
                        if (!image) {
                            if (otherChildren[0].tagName === "table") {
                                const childResult = cheerioToArchieML(
                                    otherChildren[0],
                                    $
                                )

                                return {
                                    errors: [...errors, ...childResult.errors],
                                    content: childResult.content,
                                }
                            }
                            // TODO: this is a legitimate case, there may be other content in a figure
                            // but for now we treat it as an error and see how often this error happens
                            errors.push({
                                name: "no img element in figure",
                                details: `Found ${otherChildren.length} elements`,
                            })
                        }

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
                        const spansResult = getSpansFromChildren(node, $)
                        const errors = spansResult.errors
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
                                    text: spansResult.content,
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
                        const children = cheerioNodesToArchieML(
                            node.children,
                            $
                        )

                        const [textChildren, otherChildren] = _.partition(
                            children.content,
                            isEnrichedTextBlock
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
                            const grandChildren = cheerioNodesToArchieML(
                                child.children,
                                $
                            )
                            if (grandChildren.content) return [grandChildren]
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
                            listContent: ArchieMlTransformationResult<ArchieBlockOrWpComponent>
                        ): ArchieMlTransformationResult<EnrichedBlockText> => {
                            const [textChildren, otherChildren] = _.partition(
                                listContent.content,
                                isEnrichedTextBlock
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
                    { tagName: "ol" },
                    (): ArchieMlTransformationResult<EnrichedBlockNumberedList> => {
                        const children = node.children?.flatMap((child) => {
                            const grandChildren = cheerioNodesToArchieML(
                                child.children,
                                $
                            )
                            if (grandChildren.content) return [grandChildren]
                            else return []
                        })

                        if (!children)
                            return {
                                errors: [
                                    {
                                        name: "ol without children" as const,
                                        details: `Found ol without children`,
                                    },
                                ],
                                content: [],
                            }

                        const handleListChildren = (
                            listContent: ArchieMlTransformationResult<ArchieBlockOrWpComponent>
                        ): ArchieMlTransformationResult<EnrichedBlockText> => {
                            const [textChildren, otherChildren] = _.partition(
                                listContent.content,
                                isEnrichedTextBlock
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
                                    type: "numbered-list",
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
                .otherwise(() => ({
                    errors: [
                        {
                            name: "unhandled html tag found",
                            details: `Encountered the unhandled tag ${node.tagName}`,
                        },
                    ],
                    content: [],
                }))
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

function cheerioNodesToArchieML(
    nodes: CheerioElement[],
    $: CheerioStatic
): ArchieMlTransformationResult<ArchieBlockOrWpComponent> {
    let remainingNodes: CheerioElement[] = nodes
    const parsedContent: ArchieMlTransformationResult<ArchieBlockOrWpComponent>[] =
        []
    while (remainingNodes.length > 0) {
        const node = remainingNodes[0]
        if (isWpComponentStart(node)) {
            const parseResult = parseWpComponent(remainingNodes, $)
            parsedContent.push(parseResult.result)
            remainingNodes = parseResult.remainingNodes
        } else if (node.type === "comment") {
            remainingNodes = remainingNodes.slice(1)
        } else {
            const parsed = cheerioToArchieML(node, $)
            const cleaned = withoutEmptyOrWhitespaceOnlyTextBlocks(parsed)
            if (cleaned.content.length > 0 || cleaned.errors.length > 0)
                parsedContent.push(parsed)
            remainingNodes = remainingNodes.slice(1)
        }
    }
    return joinArchieMLTransformationResults(parsedContent)
}

function withoutEmptyOrWhitespaceOnlyTextBlocks(
    result: ArchieMlTransformationResult<ArchieBlockOrWpComponent>
): ArchieMlTransformationResult<ArchieBlockOrWpComponent> {
    return {
        ...result,
        content: result.content.filter(
            (element) =>
                !("type" in element) ||
                ("type" in element && element.type !== "text") ||
                (element.value.length > 0 &&
                    element.value.some(
                        (span) =>
                            span.spanType !== "span-simple-text" ||
                            span.text.trimStart() !== ""
                    ))
        ),
    }
}

const migrate = async (): Promise<void> => {
    const writeToFile = true
    await db.getConnection()

    const posts = await Post.select(
        "id",
        "slug",
        "title",
        "content",
        "published_at",
        "updated_at"
    ).from(db.knexTable(Post.postsTable).where("id", "=", "54652"))

    // const tagCounts = new Map<string, number>()

    for (const post of posts) {
        const $: CheerioStatic = cheerio.load(post.content)
        const bodyContents = $("body").contents().toArray()
        const parseResult = cheerioNodesToArchieML(bodyContents, $)
        const archieMlBodyElements = convertAllWpComponentsToArchieMLBlocks(
            withoutEmptyOrWhitespaceOnlyTextBlocks(parseResult).content
        )

        const errors = parseResult.errors
        // archieMlForPosts.push([
        //     post.id,
        //     JSON.stringify(archieMlBlocks, null, 2),
        //     JSON.stringify(errors, null, 2),
        // ])

        const archieMlFieldContent: OwidArticleType = {
            id: `wp-${post.id}`,
            slug: post.slug,
            content: {
                body: archieMlBodyElements,
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
            numBlocks: archieMlBodyElements.length,
        }

        // const insertQuery = `
        // UPDATE posts SET archieml = ?, archieml_update_statistics = ? WHERE id = ?
        // `
        // await db.queryMysql(insertQuery, [
        //     JSON.stringify(archieMlFieldContent, null, 2),
        //     JSON.stringify(archieMlStatsContent, null, 2),
        //     post.id,
        // ])
        // console.log("inserted", post.id)

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
