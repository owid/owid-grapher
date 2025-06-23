import * as _ from "lodash-es"
import path from "path"
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
    SpanDod,
    EnrichedBlockSimpleText,
    SpanSimpleText,
    OwidEnrichedGdocBlock,
    EnrichedBlockImage,
    EnrichedBlockHeading,
    EnrichedBlockChart,
    EnrichedBlockHtml,
    EnrichedBlockList,
    EnrichedBlockNumberedList,
    EnrichedBlockProminentLink,
    BlockImageSize,
    detailOnDemandRegex,
    spansToUnformattedPlainText,
    EnrichedBlockCallout,
    EnrichedBlockBlockquote,
    traverseEnrichedSpan,
} from "@ourworldindata/utils"
import { match, P } from "ts-pattern"
import * as cheerio from "cheerio"
import { spansToSimpleString } from "./gdocUtils.js"

//#region Spans
function spanFallback(element: CheerioElement): SpanFallback {
    return {
        spanType: "span-fallback",
        children: _.compact(element.children?.map(cheerioToSpan)) ?? [],
    }
}

export function htmlToEnrichedTextBlock(html: string): EnrichedBlockText {
    return {
        type: "text",
        value: htmlToSpans(html),
        parseErrors: [],
    }
}

function consolidateSpans(
    blocks: OwidEnrichedGdocBlock[]
): OwidEnrichedGdocBlock[] {
    const newBlocks: OwidEnrichedGdocBlock[] = []
    let currentBlock: EnrichedBlockText | undefined = undefined

    for (const block of blocks) {
        if (block.type === "text") {
            if (currentBlock === undefined) {
                currentBlock = block
            } else {
                const consolidatedValue: Span[] = [...currentBlock.value]
                // If there's no space between the two blocks, add one
                const hasSpace =
                    spansToSimpleString(currentBlock.value).endsWith(" ") ||
                    spansToSimpleString(block.value).startsWith(" ")
                if (!hasSpace) {
                    consolidatedValue.push({
                        spanType: "span-simple-text",
                        text: " ",
                    })
                }
                consolidatedValue.push(...block.value)

                currentBlock = {
                    type: "text",
                    value: consolidatedValue,
                    parseErrors: [
                        ...currentBlock.parseErrors,
                        ...block.parseErrors,
                    ],
                }
            }
        } else {
            if (currentBlock) {
                newBlocks.push(currentBlock)
                currentBlock = undefined
            }
            newBlocks.push(block)
        }
    }

    // Push the last consolidated block if it exists
    if (currentBlock) {
        newBlocks.push(currentBlock)
    }

    return newBlocks
}

export function htmlToSimpleTextBlock(html: string): EnrichedBlockSimpleText {
    const spans = htmlToSpans(html)
    const [simpleTextSpans, otherSpans] = _.partition(
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
    return _.compact(elements.map(cheerioToSpan)) ?? []
}

function cheerioToSpan(element: CheerioElement): Span | undefined {
    if (element.type === "text")
        // The regex replace takes care of the ArchieML escaping of :
        return {
            spanType: "span-simple-text",
            text: element.data?.replace(/\\:/g, ":") ?? "",
        }
    else if (element.type === "tag") {
        return match(element.tagName)
            .with("a", (): SpanLink | SpanRef | SpanDod => {
                const url: string | undefined = element.attribs.href
                const className = element.attribs.class
                const children =
                    _.compact(element.children?.map(cheerioToSpan)) ?? []
                if (className === "ref") {
                    return { spanType: "span-ref", children, url }
                }
                const dod = url?.match(detailOnDemandRegex)
                if (dod) {
                    return { spanType: "span-dod", children, id: dod[1] }
                }
                return { spanType: "span-link", children, url }
            })
            .with("b", (): SpanBold => {
                const children =
                    _.compact(element.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-bold", children }
            })
            .with("i", (): SpanItalic => {
                const children =
                    _.compact(element.children?.map(cheerioToSpan)) ?? []
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
                        _.compact(element.children?.map(cheerioToSpan)) ?? [],
                })
            )
            .with(
                "q",
                (): SpanQuote => ({
                    spanType: "span-quote",
                    children:
                        _.compact(element.children?.map(cheerioToSpan)) ?? [],
                })
            )
            .with("small", () => spanFallback(element))
            .with("span", () => spanFallback(element))
            .with("strong", (): SpanBold => {
                const children =
                    _.compact(element.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-bold", children }
            })
            .with("sup", (): SpanSuperscript => {
                const children =
                    _.compact(element.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-superscript", children }
            })
            .with("sub", (): SpanSubscript => {
                const children =
                    _.compact(element.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-subscript", children }
            })
            .with("u", (): SpanUnderline => {
                const children =
                    _.compact(element.children?.map(cheerioToSpan)) ?? []
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
    | "prominent link missing title"
    | "prominent link missing url"
    | "summary item isn't text"
    | "summary item doesn't have link"
    | "unknown content type inside summary block"
    | "unknown content type inside key-insights block insights array"
    | "card missing attributes"
    | "card missing title or linkUrl"

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

type ArchieBlockOrWpComponent = OwidEnrichedGdocBlock | WpComponent

interface ParseContext {
    $: CheerioStatic
    htmlTagCounts: Record<string, number>
}

/** Unwraps a CheerioElement in the sense that it applies
    cheerioElementsToArchieML on the children, returning the result. In effect
    this "removes" an html element like a div that we don't care about on its
    own, and where instead we just want to handle the children. */
function unwrapElement(
    element: CheerioElement,
    context: ParseContext
): BlockParseResult<ArchieBlockOrWpComponent> {
    const result = cheerioElementsToArchieML(element.children, context)
    return result
}

function isArchieMlComponent(
    block: ArchieBlockOrWpComponent
): block is OwidEnrichedGdocBlock {
    return "type" in block
}

function extractProminentLinkFromBlockQuote(
    spans: Span[]
): EnrichedBlockProminentLink | undefined {
    const spansContainRelatedChart = spansToSimpleString(spans)
        .toLowerCase()
        .includes("related chart")

    if (!spansContainRelatedChart) return undefined

    let isRelatedChart = false
    let url = ""

    spans.forEach((span) =>
        traverseEnrichedSpan(span, (span) => {
            if (
                span.spanType === "span-link" &&
                span.url.includes("/grapher/")
            ) {
                url = span.url
                isRelatedChart = true
            }
        })
    )

    if (isRelatedChart)
        return {
            type: "prominent-link",
            url,
            parseErrors: [],
        }
    return
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
    if (span) {
        return {
            errors: [],
            // TODO: below should be a list of spans and a rich text block
            content: [{ type: "text", value: [span], parseErrors: [] }],
        }
    } else if (element.type === "tag") {
        context.htmlTagCounts[element.tagName] =
            (context.htmlTagCounts[element.tagName] ?? 0) + 1
        const result: BlockParseResult<ArchieBlockOrWpComponent> = match(
            element
        )
            .with({ tagName: "address" }, unwrapElementWithContext)
            .with(
                { tagName: "blockquote" },
                (): BlockParseResult<
                    EnrichedBlockBlockquote | EnrichedBlockProminentLink
                > => {
                    const spansResult = getSpansFromChildren(element, context)
                    // Sometimes blockquotes were used for prominent links before we had a bespoke
                    // component for them. Using some simple heuristics we try to convert these if possible
                    const prominentLink = extractProminentLinkFromBlockQuote(
                        spansResult.content
                    )
                    if (prominentLink)
                        return {
                            errors: [],
                            content: [prominentLink],
                        }
                    return {
                        errors: spansResult.errors,
                        content: [
                            {
                                type: "blockquote",
                                text: [
                                    {
                                        type: "text",
                                        value: spansResult.content,
                                        parseErrors: [],
                                    },
                                ],
                                parseErrors: [],
                            },
                        ],
                    }
                }
            )
            .with({ tagName: "body" }, unwrapElementWithContext)
            .with({ tagName: "center" }, unwrapElementWithContext) // might want to translate this to a block with a centered style?
            .with({ tagName: "details" }, unwrapElementWithContext)
            .with({ tagName: "div" }, (div) => {
                const className = div.attribs.class || ""
                if (className.includes("pcrm")) {
                    // pcrm stands for "preliminary collection of relevant material" which was used to designate entries
                    // that weren't fully polished, but then became a way to create a general-purpose "warning box".
                    const unwrapped = unwrapElementWithContext(element)
                    const first = unwrapped.content[0] as OwidEnrichedGdocBlock
                    const hasHeading = first.type === "heading"
                    // Use heading as the callout title if it exists
                    const title = hasHeading
                        ? spansToUnformattedPlainText(first.text)
                        : ""
                    // If we've put the first block in the callout title, remove it from the text content
                    const textBlocks = (
                        hasHeading
                            ? unwrapped.content.slice(1)
                            : unwrapped.content
                    ) as EnrichedBlockText[]
                    // Compress multiple text blocks into one
                    const consolidatedBlocks = consolidateSpans(
                        textBlocks
                    ) as EnrichedBlockText[]
                    const callout: EnrichedBlockCallout = {
                        type: "callout",
                        parseErrors: [],
                        title,
                        text: consolidatedBlocks,
                    }
                    return { errors: [], content: [callout] }
                } else {
                    return unwrapElementWithContext(div)
                }
            })
            .with({ tagName: "figcaption" }, unwrapElementWithContext)
            .with(
                { tagName: "figure" },
                (): BlockParseResult<ArchieBlockOrWpComponent> => {
                    const errors: BlockParseError[] = []
                    const [figcaptionChildren, otherChildren] = _.partition(
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
                    // The content of figure HTML elements is a bit funky. It can be images, svg, iframes,
                    // tables etc. In addition to this, an image can also be wrapped in an a tag, which for
                    // us is a text-span tag and we don't really capture this properly yet at the block level (
                    // also because this is not a very common case other than linking to a big version of the image again).
                    // So here we just try to find in the figure tag one of these relevant subtags and then try to
                    // translate them to a reasonable equivalent.
                    const image = findCheerioElementRecursive(
                        otherChildren,
                        "img"
                    )
                    const svg = findCheerioElementRecursive(
                        otherChildren,
                        "svg"
                    )
                    const iframe = findCheerioElementRecursive(
                        otherChildren,
                        "iframe"
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
                        } else if (svg) {
                            // SVGs are translated to HTML blocks with the svg content unchanged
                            const svgResult = cheerioToArchieML(svg, context)
                            return {
                                errors: [...errors, ...svgResult.errors],
                                content: svgResult.content,
                            }
                        } else if (iframe) {
                            // iframes are checked for their URL and usually result in a grapher chart being returned
                            const iframeResult = cheerioToArchieML(
                                iframe,
                                context
                            )
                            return {
                                errors: [...errors, ...iframeResult.errors],
                                content: iframeResult.content,
                            }
                        } else {
                            // TODO: this is a legitimate case, there may be other content in a figure
                            // but for now we treat it as an error and see how often this error happens
                            errors.push({
                                name: "no img element in figure",
                                details: `Found ${otherChildren.length} elements`,
                            })
                        }
                    }

                    return {
                        errors,
                        content: [
                            {
                                type: "image",
                                // src is the entire path. we only want the filename
                                filename: path
                                    .basename(image?.attribs["src"] ?? "")
                                    .replace(
                                        // removing size suffixes e.g. some_file-1280x840.png -> some_file.png
                                        /-\d+x\d+\.(png|jpg|jpeg|gif|svg)$/,
                                        ".$1"
                                    ),
                                alt: image?.attribs["alt"] ?? "",
                                parseErrors: [],
                                originalWidth: undefined,
                                hasOutline: false,
                                caption: figcaptionElement?.value,
                                size: BlockImageSize.Wide,
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
                    if (spansResult.content.length === 0)
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
                                // TODO: ike
                                filename: src,
                                alt: "",
                                parseErrors: [],
                                hasOutline: false,
                                originalWidth: undefined,
                                size: BlockImageSize.Wide,
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
                { tagName: "table" },
                (): BlockParseResult<EnrichedBlockHtml> => {
                    return {
                        errors: [],
                        content: [
                            {
                                type: "html",
                                value: `<div class="raw-html-table__container">${
                                    context.$.html(element) ?? ""
                                }</div>`,
                                parseErrors: [],
                            },
                        ],
                    }
                }
            )
            .with(
                { tagName: P.union("svg", "video") },
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

function cheerioElementsToArchieML(
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
        if (element.type === "comment") {
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

function withoutEmptyOrWhitespaceOnlyTextBlocks(
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
function joinBlockParseResults<T>(
    results: BlockParseResult<T>[]
): BlockParseResult<T> {
    const errors = results.flatMap((r) => r.errors)
    const content = results.flatMap((r) => r.content)
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

function getSpansFromChildren(
    element: CheerioElement,
    context: ParseContext
): BlockParseResult<Span> {
    const childElements = joinBlockParseResults(
        element.children.map((child) => cheerioToArchieML(child, context))
    )
    return getSpansFromBlockParseResult(childElements)
}

function getSpansFromBlockParseResult(
    result: BlockParseResult<ArchieBlockOrWpComponent>
): BlockParseResult<Span> {
    const textBlockResult = getEnrichedBlockTextFromBlockParseResult(result)
    return {
        content: textBlockResult.content.flatMap((text) => text.value),
        errors: textBlockResult.errors,
    }
}

function getEnrichedBlockTextFromBlockParseResult(
    result: BlockParseResult<ArchieBlockOrWpComponent>
): BlockParseResult<EnrichedBlockText> {
    const [textChildren, otherChildren] = _.partition(
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
