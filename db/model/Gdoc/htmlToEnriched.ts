import {
    Span,
    EnrichedBlockText,
    SpanLink,
    SpanBold,
    SpanItalic,
    SpanFallback,
    SpanQuote,
    SpanSuperscript,
    SpanSubscript,
    SpanUnderline,
    SpanRef,
    EnrichedBlockSimpleText,
    SpanSimpleText,
    OwidEnrichedArticleBlock,
    EnrichedBlockImage,
    EnrichedBlockPullQuote,
    EnrichedBlockHeading,
    EnrichedBlockChart,
    EnrichedBlockHtml,
    EnrichedBlockList,
    EnrichedBlockStickyRightContainer,
    EnrichedBlockNumberedList,
} from "@ourworldindata/utils"
import { match, P } from "ts-pattern"
import { compact, flatten, isPlainObject, partition } from "lodash"
import * as cheerio from "cheerio"

//#region Spans
function spanFallback(element: CheerioElement): SpanFallback {
    return {
        spanType: "span-fallback",
        children: compact(element.children?.map(cheerioToSpan)) ?? [],
    }
}

export function htmlToEnrichedTextBlock(html: string): EnrichedBlockText {
    return {
        type: "text",
        value: htmlToSpans(html),
        parseErrors: [],
    }
}

export function consolidateSpans(
    blocks: OwidEnrichedArticleBlock[]
): OwidEnrichedArticleBlock[] {
    const newBlocks: OwidEnrichedArticleBlock[] = []
    let currentBlock: EnrichedBlockText | undefined = undefined
    for (const block of blocks) {
        if (block.type === "text")
            if (currentBlock === undefined) currentBlock = block
            else
                currentBlock = {
                    type: "text",
                    value: [...currentBlock.value, ...block.value],
                    parseErrors: [],
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

export function htmlToSimpleTextBlock(html: string): EnrichedBlockSimpleText {
    const spans = htmlToSpans(html)
    const [simpleTextSpans, otherSpans] = partition(
        spans,
        (s) => s.spanType === "span-simple-text"
    )
    const simpleText: SpanSimpleText = {
        spanType: "span-simple-text",
        text: simpleTextSpans.map((s) => (s as SpanSimpleText).text).join(" "),
    }
    const parseErrors =
        otherSpans.length > 0
            ? [
                  {
                      message:
                          "Formatted text fragments found in simple text block",
                  },
              ]
            : []
    return {
        type: "simple-text",
        value: simpleText,
        parseErrors: parseErrors,
    }
}

export function htmlToSpans(html: string): Span[] {
    const $ = cheerio.load(html)
    const elements = $("body").contents().toArray()
    return compact(elements.map(cheerioToSpan)) ?? []
}

export function cheerioToSpan(element: CheerioElement): Span | undefined {
    if (element.type === "text")
        // The regex replace takes care of the ArchieML escaping of :
        return {
            spanType: "span-simple-text",
            text: element.data?.replace(/\\:/g, ":") ?? "",
        }
    else if (element.type === "tag") {
        return match(element.tagName)
            .with("a", (): SpanLink | SpanRef => {
                const url = element.attribs.href
                const className = element.attribs.class
                const children =
                    compact(element.children?.map(cheerioToSpan)) ?? []
                if (className === "ref") {
                    return { spanType: "span-ref", children, url }
                }
                return { spanType: "span-link", children, url }
            })
            .with("b", (): SpanBold => {
                const children =
                    compact(element.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-bold", children }
            })
            .with("i", (): SpanItalic => {
                const children =
                    compact(element.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-italic", children }
            })
            .with("br", (): Span => ({ spanType: "span-newline" }))
            .with("cite", () => spanFallback(element))
            .with("code", () => spanFallback(element)) // TODO: should get a style
            .with(
                "em",
                (): SpanItalic => ({
                    spanType: "span-italic",
                    children:
                        compact(element.children?.map(cheerioToSpan)) ?? [],
                })
            )
            .with(
                "q",
                (): SpanQuote => ({
                    spanType: "span-quote",
                    children:
                        compact(element.children?.map(cheerioToSpan)) ?? [],
                })
            )
            .with("small", () => spanFallback(element))
            .with("span", () => spanFallback(element))
            .with("strong", (): SpanBold => {
                const children =
                    compact(element.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-bold", children }
            })
            .with("sup", (): SpanSuperscript => {
                const children =
                    compact(element.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-superscript", children }
            })
            .with("sub", (): SpanSubscript => {
                const children =
                    compact(element.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-subscript", children }
            })
            .with("u", (): SpanUnderline => {
                const children =
                    compact(element.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-underline", children }
            })
            .with("wbr", () => spanFallback(element))
            .otherwise(() => {
                return undefined
            })
    }
    return undefined
}

//#endregion

//#region block level elements

/** This type enumerates the errors that can come up during Html to Enriched
    block parsing. Using a union of string literals here is a bit of an experiment
    to give you both human readable titles and a closed set of options for
    exhaustivness checking when handling errors */
type ErrorNames =
    | "blockquote content is not just text"
    | "too many figcaption elements"
    | "too many figcaption elements after archieml transform"
    | "too many figcaption elements after archieml transform"
    | "figcaption element is not structured text"
    | "unkown element tag"
    | "expected only plain text"
    | "expected only text"
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

interface BlockParseError {
    name: ErrorNames

    details: string
}

interface BlockParseResult<T> {
    errors: BlockParseError[]
    content: T[]
}
interface WpComponent {
    tagName: string
    attributes: Record<string, unknown> | undefined
    isVoidElement: boolean
    childrenResults: ArchieBlockOrWpComponent[]
}

type ArchieBlockOrWpComponent = OwidEnrichedArticleBlock | WpComponent

/** This type is used to keep track of intermediate results when parsing WpComponents where
    we have to keep track of the remaining elements (i.e. those that have not been consumed yet) */
interface WpComponentIntermediateParseResult {
    result: BlockParseResult<ArchieBlockOrWpComponent>
    remainingElements: CheerioElement[]
}

interface ParseContext {
    $: CheerioStatic
    shouldParseWpComponents: boolean
    htmlTagCounts: Record<string, number>
    wpTagCounts: Record<string, number>
}

/** Regular expression to identify wordpress components in html components. These
    components always have the structure
    wp:TAGNAME {"optionalAttributeExample": 4}
    This regex parses this structure and captures the groups tag (tagname), attributes
    (optional JSON attributes) and isVoidElement which indicates if the comment ends with
    /--> to indicate a void wp component, i.e. one without a matching closing tag similar
    to some html tags like <br />
    */
const wpTagRegex =
    /wp:(?<tag>([\w\/-]+))\s*(?<attributes>{.*})?\s*(?<isVoidElement>\/)?$/

/** Unwraps a CheerioElement in the sense that it applies cheerioelementsToArchieML
    on the children, returning the result. In effect this "removes" an html element
    like a div that we don't care about in it's own, and where instead we just want to handle
    the children. */
function unwrapElement(
    element: CheerioElement,
    context: ParseContext
): BlockParseResult<ArchieBlockOrWpComponent> {
    const result = cheerioElementsToArchieML(element.children, context)
    return result
}

function isWpComponentStart(element: CheerioElement): boolean {
    return (
        element.type === "comment" &&
        (element.data?.trimStart()?.startsWith("wp:") ?? false)
    )
}

function isWpComponentEnd(element: CheerioElement): boolean {
    return (
        element.type === "comment" &&
        (element.data?.trimStart()?.startsWith("/wp:") ?? false)
    )
}

function getWpComponentDetails(element: CheerioElement): WpComponent {
    const match = element.data?.match(wpTagRegex)
    if (!match) throw new Error("WpComponent could not match")
    let attributes
    if (match.groups?.attributes) {
        try {
            const parsed = JSON.parse(match.groups?.attributes)
            if (isPlainObject(parsed)) {
                attributes = parsed
            }
        } catch {
            throw new Error("Invalid JSON in WpComponent attributes")
        }
    }
    return {
        tagName: match.groups!.tag!,
        attributes,
        isVoidElement: match.groups?.isVoidElement !== undefined,
        childrenResults: [],
    }
}

function tryGetAsWpComponentOfType(
    blockOrComponent: ArchieBlockOrWpComponent,
    expectedTagName: string
): WpComponent | undefined {
    // This function returns the narrowed type instead of doing a type guard
    // so that the useage site can immediately use the narrowed value
    return !("tagName" in blockOrComponent) ||
        blockOrComponent.tagName !== expectedTagName
        ? undefined
        : blockOrComponent
}

function isArchieMlComponent(
    block: ArchieBlockOrWpComponent
): block is OwidEnrichedArticleBlock {
    return "type" in block
}

export function convertAllWpComponentsToArchieMLBlocks(
    blocksOrComponents: ArchieBlockOrWpComponent[]
): OwidEnrichedArticleBlock[] {
    return blocksOrComponents.flatMap((blockOrComponent) => {
        if (isArchieMlComponent(blockOrComponent)) return [blockOrComponent]
        else {
            return convertAllWpComponentsToArchieMLBlocks(
                blockOrComponent.childrenResults
            )
        }
    })
}

/** Parse a Wordpress component. This function has to be called when the first element of
    elements contains a comment that is a WpComponent start tag. It then iterates through
    the list of elements until it finds the matching closing comment tag and returns the
    found component as well as the list of elements that were not consumed in parsing the
    wp component.

    Nested components are properly taken care of - if it should find e.g.:
    <-- wp:columns -->
    <-- wp:column -->
    <-- /wp:column -->
    <-- /wp:columns -->

    then the result will be one component nested in another. Whether components are parsed
    as WpComponent or directly as an OwidEnrichedArticleBlock depends on whether we have all
    the information we need to created an OwidEnrichedArticleBlock or if we need to keep the
    temporary structure of a WpCompnent around (e.g. the latter is the case for wp:column
    contained inside wp:columns)
     */
export function parseWpComponent(
    elements: CheerioElement[],
    context: ParseContext
): WpComponentIntermediateParseResult {
    // Below are tags we don't want to try and track as components but just fully ignore -
    // The reason for this differs a bit by tag. For wp:html the issue is that the opening
    // and closing tags are on different nesting levels which totally messes up the rest of
    // the logic and we don't really care for those tags.
    // wp:heading and wp:paragraph are redundant. They would parse find if we weren't doing
    // the somewhat brutal ref parsing via regex that just cuts some parts of the raw html
    // out. But by ignoring these three component tags that for now we don't seem to need
    // we get clean parsing of the rest of the components.
    const wpComponentTagsToIgnore = ["html", "heading", "paragraph"]

    const startElement = elements[0]
    if (!isWpComponentStart(startElement))
        throw new Error(
            "Tried to start parsing a WP component on a non-comment block!"
        )
    const componentDetails = getWpComponentDetails(startElement)
    context.wpTagCounts[componentDetails.tagName] =
        (context.wpTagCounts[componentDetails.tagName] ?? 0) + 1

    let remainingElements = elements.slice(1)
    const collectedContent: BlockParseResult<ArchieBlockOrWpComponent>[] = []
    // If the wp component tag was closing (ended with /--> ) or if this is a component
    // tag that we want to ignore then don't try to find a closing tag
    if (
        componentDetails.isVoidElement ||
        wpComponentTagsToIgnore.includes(componentDetails.tagName)
    )
        return {
            remainingElements,
            result: {
                errors: [],
                content: [componentDetails],
            },
        }
    // Now iterate until we find the matching closing tag. If we find an opening wp:component
    // tag then start a new recursive parseWpComponent call
    else
        while (remainingElements.length > 0) {
            const element = remainingElements[0]
            if (isWpComponentEnd(element)) {
                const closingDetails = getWpComponentDetails(element)
                if (wpComponentTagsToIgnore.includes(closingDetails.tagName)) {
                    remainingElements = remainingElements.slice(1)
                    continue
                }

                if (closingDetails.tagName !== componentDetails.tagName) {
                    throw new Error(
                        `Found a closing tag (${closingDetails.tagName}) that did not match the expected open tag (${componentDetails.tagName})`
                    )
                }
                const collectedChildren =
                    joinBlockParseResults(collectedContent)

                return {
                    result: finishWpComponent(
                        componentDetails,
                        withoutEmptyOrWhitespaceOnlyTextBlocks(
                            collectedChildren
                        )
                    ),
                    remainingElements: remainingElements.slice(1),
                }
            } else if (isWpComponentStart(element)) {
                const result = parseWpComponent(remainingElements, context)
                remainingElements = result.remainingElements
                collectedContent.push(result.result)
            } else {
                const parsed = cheerioToArchieML(element, context)
                collectedContent.push(parsed)
                remainingElements = remainingElements.slice(1)
            }
        }
    throw new Error(
        `Tried parsing a WP component but never found a matching end tag for ${componentDetails.tagName}`
    )
}

/** Handles finishing a partially parsed WpComponent when we get to the closing tag. When
    a tag contains all the information needed to turn it into an OwidEnrichedArticleBlock then
    we create that - otherwise we keep the WpComponent around with the children content filled in */
function finishWpComponent(
    details: WpComponent,
    content: BlockParseResult<ArchieBlockOrWpComponent>
): BlockParseResult<ArchieBlockOrWpComponent> {
    return match(details.tagName)
        .with("column", (): BlockParseResult<ArchieBlockOrWpComponent> => {
            return {
                content: [
                    {
                        ...details,
                        childrenResults: content.content,
                    },
                ],
                errors: content.errors,
            }
        })
        .with("columns", () => {
            const errors = content.errors
            if (content.content.length !== 2) {
                errors.push({
                    name: "columns block expects 2 children",
                    details: `Got ${content.content.length} children instead`,
                })
                return { ...content, errors }
            }
            const firstChild = tryGetAsWpComponentOfType(
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
            const secondChild = tryGetAsWpComponentOfType(
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

function isEnrichedTextBlock(
    item: ArchieBlockOrWpComponent
): item is EnrichedBlockText {
    return isArchieMlComponent(item) && item.type === "text"
}

function cheerioToArchieML(
    element: CheerioElement,
    context: ParseContext
): BlockParseResult<ArchieBlockOrWpComponent> {
    if (element.type === "comment") return { errors: [], content: [] }

    const unwrapElementWithContext = (
        element: CheerioElement
    ): BlockParseResult<ArchieBlockOrWpComponent> =>
        unwrapElement(element, context)

    const span = cheerioToSpan(element)
    if (span)
        return {
            errors: [],
            // TODO: below should be a list of spans and a rich text block
            content: [{ type: "text", value: [span], parseErrors: [] }],
        }
    else if (element.type === "tag") {
        context.htmlTagCounts[element.tagName] =
            (context.htmlTagCounts[element.tagName] ?? 0) + 1
        const result: BlockParseResult<ArchieBlockOrWpComponent> = match(
            element
        )
            .with({ tagName: "address" }, unwrapElementWithContext)
            .with(
                { tagName: "blockquote" },
                (): BlockParseResult<EnrichedBlockPullQuote> => {
                    const spansResult = getSimpleTextSpansFromChildren(
                        element, //bla
                        context
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
            .with({ tagName: "body" }, unwrapElementWithContext)
            .with({ tagName: "center" }, unwrapElementWithContext) // might want to translate this to a block with a centered style?
            .with({ tagName: "details" }, unwrapElementWithContext)
            .with({ tagName: "div" }, unwrapElementWithContext)
            .with({ tagName: "figcaption" }, unwrapElementWithContext)
            .with(
                { tagName: "figure" },
                (): BlockParseResult<ArchieBlockOrWpComponent> => {
                    const errors: BlockParseError[] = []
                    const [figcaptionChildren, otherChildren] = partition(
                        element.children,
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
                                ? cheerioElementsToArchieML(
                                      figcaptionChildren,
                                      context
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
                                            isArchieMlComponent(element)
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
                    const image = findCheerioElementRecursive(
                        otherChildren,
                        "img"
                    )
                    if (!image) {
                        if (otherChildren[0].tagName === "table") {
                            const childResult = cheerioToArchieML(
                                otherChildren[0],
                                context
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
                (): BlockParseResult<EnrichedBlockHeading> => {
                    const level = parseInt(element.tagName.slice(1))
                    const spansResult = getSpansFromChildren(element, context)
                    const errors = spansResult.errors
                    if (spansResult.content.length == 0)
                        errors.push({
                            name: "exepcted a single plain text element, got zero" as const,
                            details: `Found 0 elements after transforming to archieml`,
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
                (): BlockParseResult<EnrichedBlockChart> => {
                    const src = element.attribs.src
                    const errors: BlockParseError[] = []
                    if (!src)
                        errors.push({
                            name: "iframe without src" as const,
                            details: `Found iframe without src attribute`,
                        })
                    if (
                        !(
                            src?.startsWith(
                                "https://ourworldindata.org/grapher/"
                            ) ||
                            src?.startsWith(
                                "https://ourworldindata.org/explorers/"
                            )
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
                (): BlockParseResult<EnrichedBlockImage> => {
                    const src = element.attribs.src
                    const errors: BlockParseError[] = []
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
            .with({ tagName: "p" }, (): BlockParseResult<EnrichedBlockText> => {
                const children = cheerioElementsToArchieML(
                    element.children,
                    context
                )

                const [textChildren, otherChildren] = partition(
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
                            value: textChildren.flatMap((child) => child.value),
                            parseErrors: [],
                        },
                    ],
                }
            })
            .with(
                { tagName: "ul" },
                (): BlockParseResult<EnrichedBlockList> => {
                    const children = element.children?.flatMap((child) => {
                        if (!child.children) return []
                        const grandChildren = cheerioElementsToArchieML(
                            child.children,
                            context
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
                        listContent: BlockParseResult<ArchieBlockOrWpComponent>
                    ): BlockParseResult<EnrichedBlockText> => {
                        const [textChildren, otherChildren] = partition(
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

                    const listChildren = joinBlockParseResults(
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
                (): BlockParseResult<EnrichedBlockNumberedList> => {
                    const children = element.children?.flatMap((child) => {
                        const grandChildren = cheerioElementsToArchieML(
                            child.children,
                            context
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
                        listContent: BlockParseResult<ArchieBlockOrWpComponent>
                    ): BlockParseResult<EnrichedBlockText> => {
                        const [textChildren, otherChildren] = partition(
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

                    const listChildren = joinBlockParseResults(
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
                (): BlockParseResult<EnrichedBlockHtml> => {
                    return {
                        errors: [],
                        content: [
                            {
                                type: "html",
                                value: context.$.html(element) ?? "",
                                parseErrors: [],
                            },
                        ],
                    }
                }
            )
            .otherwise(() => ({
                errors: [
                    {
                        name: "unhandled html tag found",
                        details: `Encountered the unhandled tag ${element.tagName}`,
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
                    details: `type was ${element.type}`,
                },
            ],
            content: [],
        }
}

export function cheerioElementsToArchieML(
    elements: CheerioElement[],
    context: ParseContext
): BlockParseResult<ArchieBlockOrWpComponent> {
    if (!elements || !elements.length)
        return {
            errors: [],
            content: [],
        }
    let remainingElements: CheerioElement[] = elements
    const parsedContent: BlockParseResult<ArchieBlockOrWpComponent>[] = []
    while (remainingElements.length > 0) {
        const element = remainingElements[0]
        if (isWpComponentStart(element) && context.shouldParseWpComponents) {
            const parseResult = parseWpComponent(remainingElements, context)
            parsedContent.push(parseResult.result)
            remainingElements = parseResult.remainingElements
        } else if (element.type === "comment") {
            remainingElements = remainingElements.slice(1)
        } else {
            const parsed = cheerioToArchieML(element, context)
            const cleaned = withoutEmptyOrWhitespaceOnlyTextBlocks(parsed)
            if (cleaned.content.length > 0 || cleaned.errors.length > 0)
                // we don't use cleaned here because we want to keep
                // whitespaces if there is text content. The purpose
                // of cleaned is just to tell us if the parsed nodes
                // are exclusively whitespace blocks in which case we don't
                // want to keep them around at all
                parsedContent.push(parsed)
            remainingElements = remainingElements.slice(1)
        }
    }
    return joinBlockParseResults(parsedContent)
}

export function withoutEmptyOrWhitespaceOnlyTextBlocks(
    result: BlockParseResult<ArchieBlockOrWpComponent>
): BlockParseResult<ArchieBlockOrWpComponent> {
    const hasAnyNonWSSpans = (spans: Span[]): boolean =>
        spans.some(
            (span) =>
                span.spanType !== "span-simple-text" ||
                span.text.trimStart() !== ""
        )
    return {
        ...result,
        content: result.content.filter(
            (element) =>
                !isArchieMlComponent(element) ||
                (isArchieMlComponent(element) && element.type !== "text") ||
                hasAnyNonWSSpans(element.value)
        ),
    }
}

/** Joins an array of BlockParseResults into a single one by
    flattening the errors and content arrays inside of them. */
export function joinBlockParseResults<T>(
    results: BlockParseResult<T>[]
): BlockParseResult<T> {
    const errors = flatten(results.map((r) => r.errors))
    const content = flatten(results.map((r) => r.content))
    return { errors, content }
}

function findCheerioElementRecursive(
    elements: CheerioElement[],
    tagName: string
): CheerioElement | undefined {
    for (const element of elements) {
        if (element.tagName === tagName) return element
        else {
            const result = findCheerioElementRecursive(
                element.children ?? [],
                tagName
            )
            if (result !== undefined) return result
        }
    }
    return undefined
}

function getSimpleSpans(spans: Span[]): [SpanSimpleText[], Span[]] {
    return partition(
        spans,
        (span: Span): span is SpanSimpleText =>
            span.spanType === "span-simple-text"
    )
}

function getSimpleTextSpansFromChildren(
    element: CheerioElement,
    context: ParseContext
): BlockParseResult<SpanSimpleText> {
    const spansResult = getSpansFromChildren(element, context)
    const [simpleSpans, otherSpans] = getSimpleSpans(spansResult.content)
    const errors =
        otherSpans.length === 0
            ? spansResult.errors
            : [
                  ...spansResult.errors,
                  {
                      name: "expected only plain text" as const,
                      details: `suppressed tags: ${otherSpans
                          .map((s) => s.spanType)
                          .join(", ")}`,
                  },
              ]
    return {
        errors,
        content: simpleSpans,
    }
}

function getSpansFromChildren(
    element: CheerioElement,
    context: ParseContext
): BlockParseResult<Span> {
    const childElements = joinBlockParseResults(
        element.children.map((child) => cheerioToArchieML(child, context))
    )
    return getSpansFromBlockParseResult(childElements)
}

export function getSpansFromBlockParseResult(
    result: BlockParseResult<ArchieBlockOrWpComponent>
): BlockParseResult<Span> {
    const textBlockResult = getEnrichedBlockTextFromBlockParseResult(result)
    return {
        content: textBlockResult.content.flatMap((text) => text.value),
        errors: textBlockResult.errors,
    }
}

export function getEnrichedBlockTextFromBlockParseResult(
    result: BlockParseResult<ArchieBlockOrWpComponent>
): BlockParseResult<EnrichedBlockText> {
    const [textChildren, otherChildren] = partition(
        result.content,
        isEnrichedTextBlock
    )

    const errors =
        otherChildren.length === 0
            ? result.errors
            : [
                  ...result.errors,
                  {
                      name: "expected only text" as const,
                      details: `suppressed tags: ${otherChildren
                          .map((c) => (isArchieMlComponent(c) && c.type) ?? "")
                          .join(", ")}`,
                  },
              ]
    return {
        errors: errors,
        content: textChildren,
    }
}

//#endregion
