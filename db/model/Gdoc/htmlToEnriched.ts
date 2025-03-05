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
    EnrichedBlockEntrySummary,
    EnrichedBlockEntrySummaryItem,
    spansToUnformattedPlainText,
    checkNodeIsSpanLink,
    Url,
    EnrichedBlockCallout,
    EnrichedBlockExpandableParagraph,
    EnrichedBlockGraySection,
    EnrichedBlockStickyRightContainer,
    EnrichedBlockBlockquote,
    EnrichedBlockHorizontalRule,
    traverseEnrichedSpan,
    EnrichedBlockTopicPageIntro,
    EnrichedTopicPageIntroRelatedTopic,
    EnrichedBlockKeyInsightsSlide,
    EnrichedBlockKeyInsights,
    checkIsPlainObjectWithGuard,
    EnrichedBlockResearchAndWriting,
    EnrichedBlockResearchAndWritingLink,
    EnrichedBlockResearchAndWritingRow,
    EnrichedBlockAllCharts,
} from "@ourworldindata/utils"
import { match, P } from "ts-pattern"
import { compact, get, isArray, isPlainObject, partition } from "lodash"
import * as cheerio from "cheerio"
import { spansToSimpleString } from "./gdocUtils.js"

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
            .with("a", (): SpanLink | SpanRef | SpanDod => {
                const url: string | undefined = element.attribs.href
                const className = element.attribs.class
                const children =
                    compact(element.children?.map(cheerioToSpan)) ?? []
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

/** This type is used to keep track of intermediate results when parsing WpComponents where
    we have to keep track of the remaining elements (i.e. those that have not been consumed yet) */
interface WpComponentIntermediateParseResult {
    result: BlockParseResult<ArchieBlockOrWpComponent>
    remainingElements: CheerioElement[]
}

interface ParseContext {
    $: cheerio.CheerioAPI
    shouldParseWpComponents: boolean
    htmlTagCounts: Record<string, number>
    wpTagCounts: Record<string, number>
    isEntry?: boolean
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
    /wp:(?<tag>([\w/-]+))\s*(?<attributes>{.*})?\s*(?<isVoidElement>\/)?$/

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
): block is OwidEnrichedGdocBlock {
    return "type" in block
}

export function convertAllWpComponentsToArchieMLBlocks(
    blocksOrComponents: ArchieBlockOrWpComponent[] = []
): OwidEnrichedGdocBlock[] {
    return blocksOrComponents.flatMap((blockOrComponentOrToc) => {
        if (isArchieMlComponent(blockOrComponentOrToc))
            return [blockOrComponentOrToc]
        else {
            return convertAllWpComponentsToArchieMLBlocks(
                blockOrComponentOrToc.childrenResults
            )
        }
    })
}

export function findMinimumHeadingLevel(
    blocks: OwidEnrichedGdocBlock[]
): number {
    let minBlockLevel = 6
    for (const block of blocks) {
        if (block.type === "heading") {
            minBlockLevel = Math.min(block.level, minBlockLevel)
        } else if ("children" in block) {
            minBlockLevel = Math.min(
                findMinimumHeadingLevel(
                    block.children as OwidEnrichedGdocBlock[]
                ),
                minBlockLevel
            )
        }
    }
    return minBlockLevel
}

export function adjustHeadingLevels(
    blocks: OwidEnrichedGdocBlock[],
    minHeadingLevel: number,
    isEntry: boolean
): void {
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]
        if (block.type === "heading") {
            if (isEntry && block.level === 2) {
                const hr: EnrichedBlockHorizontalRule = {
                    type: "horizontal-rule",
                    parseErrors: [],
                }
                blocks.splice(i, 0, { ...hr })
                blocks.splice(i + 2, 0, { ...hr })
                i += 2
            }
            const correction = isEntry
                ? minHeadingLevel - 1
                : Math.max(0, minHeadingLevel - 2)
            block.level -= correction
        } else if ("children" in block) {
            adjustHeadingLevels(
                block.children as OwidEnrichedGdocBlock[],
                minHeadingLevel,
                isEntry
            )
        }
    }
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
    as WpComponent or directly as an OwidEnrichedGdocBlock depends on whether we have all
    the information we need to created an OwidEnrichedGdocBlock or if we need to keep the
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
    if (componentDetails.isVoidElement)
        return {
            result: finishWpComponent(
                componentDetails,
                {
                    errors: [],
                    content: [],
                },
                context
            ),
            remainingElements: remainingElements,
        }
    if (wpComponentTagsToIgnore.includes(componentDetails.tagName))
        return {
            remainingElements,
            result: {
                errors: [],
                content: [],
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
                        ),
                        context
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
    a tag contains all the information needed to turn it into an OwidEnrichedGdocBlock then
    we create that - otherwise we keep the WpComponent around with the children content filled in */
function finishWpComponent(
    details: WpComponent,
    content: BlockParseResult<ArchieBlockOrWpComponent>,
    context: ParseContext
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

            // For linear entries, we always want them to be a single column
            if (context.isEntry) {
                return {
                    errors,
                    content: convertAllWpComponentsToArchieMLBlocks([
                        ...firstChild.childrenResults,
                        ...secondChild.childrenResults,
                    ]),
                }
            }

            // If both children are empty then we don't want to create a columns block
            if (
                firstChild.childrenResults.length === 0 &&
                secondChild.childrenResults.length === 0
            ) {
                return {
                    errors,
                    content: [],
                }
            }
            // If one of the children is empty then don't create a two column layout but
            // just return the non-empty child
            if (firstChild.childrenResults.length === 0) {
                return {
                    errors,
                    content: convertAllWpComponentsToArchieMLBlocks(
                        secondChild.childrenResults
                    ),
                }
            }
            if (secondChild.childrenResults.length === 0) {
                return {
                    errors,
                    content: convertAllWpComponentsToArchieMLBlocks(
                        firstChild.childrenResults
                    ),
                }
            }

            // if both columns have content, create a sticky-right layout
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
        .with("owid/prominent-link", () => {
            const errors = content.errors
            const title = details.attributes?.title as string | undefined
            const url = details.attributes?.linkUrl as string | undefined
            if (title === undefined) {
                errors.push({
                    name: "prominent link missing title",
                    details: `Prominent link is missing a title attribute`,
                })
            }
            if (url === undefined) {
                errors.push({
                    name: "prominent link missing url",
                    details: `Prominent link is missing a linkUrl attribute`,
                })
            }
            if (title !== undefined && url !== undefined) {
                const descriptionBlock =
                    content.content.length > 0 ? content.content[0] : undefined
                let description = ""
                if (descriptionBlock && isEnrichedTextBlock(descriptionBlock)) {
                    description = spansToSimpleString(descriptionBlock.value)
                }
                return {
                    errors,
                    content: [
                        {
                            type: "prominent-link",
                            title,
                            url,
                            description,
                            parseErrors: [],
                        } as EnrichedBlockProminentLink,
                    ],
                }
            } else return { ...content, errors }
        })
        .with("owid/summary", () => {
            // Summaries can either be lists of anchor links, or paragraphs of text
            // If it's a paragraph of text, we want to turn it into a callout block
            // If it's a list of anchor links, we want to turn it into a toc block
            const contentIsAllText =
                content.content.find(
                    (block) =>
                        isArchieMlComponent(block) && block.type !== "text"
                ) === undefined

            if (contentIsAllText) {
                const callout: EnrichedBlockCallout = {
                    type: "callout",
                    title: "Summary",
                    text: content.content as EnrichedBlockText[],
                    parseErrors: [],
                }
                return { errors: [], content: [callout] }
            }

            const contentIsList =
                content.content.length === 1 &&
                isArchieMlComponent(content.content[0]) &&
                content.content[0].type === "list"
            if (contentIsList) {
                const listItems = get(content, ["content", 0, "items"])
                const items: EnrichedBlockEntrySummaryItem[] = []
                const errors = content.errors
                if (isArray(listItems)) {
                    listItems.forEach((item) => {
                        if (item.type === "text") {
                            const value = item.value[0]
                            if (checkNodeIsSpanLink(value)) {
                                const { hash } = Url.fromURL(value.url)
                                const text = spansToUnformattedPlainText(
                                    value.children
                                )
                                items.push({
                                    // Remove "#" from the beginning of the slug
                                    slug: hash.slice(1),
                                    text: text,
                                })
                            } else {
                                errors.push({
                                    name: "summary item doesn't have link",
                                    details: value
                                        ? `spanType is ${value.spanType}`
                                        : "No item",
                                })
                            }
                        } else {
                            errors.push({
                                name: "summary item isn't text",
                                details: `item is type: ${item.type}`,
                            })
                        }
                    })
                }
                const toc: EnrichedBlockEntrySummary = {
                    type: "entry-summary",
                    items,
                    parseErrors: [],
                }
                return { errors: [], content: [toc] }
            }

            const error: BlockParseError = {
                name: "unknown content type inside summary block",
                details:
                    "Unknown summary content: " +
                    content.content
                        .map((block) =>
                            isArchieMlComponent(block)
                                ? block.type
                                : block.tagName
                        )
                        .join(", "),
            }
            return {
                errors: [error],
                content: [],
            }
        })
        .with("owid/additional-information", () => {
            const heading: EnrichedBlockHeading = {
                type: "heading",
                level: 2,
                text: [
                    {
                        spanType: "span-simple-text",
                        text: "Additional information",
                    },
                ],
                parseErrors: [],
            }
            const expandableParagraph: EnrichedBlockExpandableParagraph = {
                type: "expandable-paragraph",
                items: content.content.slice(1) as OwidEnrichedGdocBlock[],
                parseErrors: [],
            }
            const graySection: EnrichedBlockGraySection = {
                type: "gray-section",
                parseErrors: [],
                items: [heading, expandableParagraph],
            }
            return {
                errors: [],
                content: [graySection],
            }
        })
        .with("owid/front-matter", () => {
            const stickyRight = content.content.find(
                (block) =>
                    isArchieMlComponent(block) && block.type === "sticky-right"
            ) as EnrichedBlockStickyRightContainer | undefined

            const gdocTopicPageIntroContent = get(
                stickyRight,
                "left",
                []
            ) as EnrichedBlockText[]

            const wpRelatedTopics = get(stickyRight, "right", []).find(
                (block) => block.type === "list"
            ) as EnrichedBlockList | undefined

            const gdocRelatedTopics: EnrichedTopicPageIntroRelatedTopic[] = []
            if (wpRelatedTopics) {
                wpRelatedTopics.items.forEach((item) => {
                    if (item.type === "text") {
                        const value = item.value[0]
                        if (checkNodeIsSpanLink(value)) {
                            gdocRelatedTopics.push({
                                url: value.url,
                                text: spansToUnformattedPlainText(
                                    value.children
                                ),
                                type: "topic-page-intro-related-topic",
                            })
                        }
                    }
                })
            }

            const topicPageIntro: EnrichedBlockTopicPageIntro = {
                type: "topic-page-intro",
                parseErrors: [],
                relatedTopics: gdocRelatedTopics,
                content: gdocTopicPageIntroContent,
            }
            return {
                errors: [],
                content: [topicPageIntro],
            }
        })
        .with("owid/technical-text", () => {
            const text = []
            for (const block of content.content) {
                if (isArchieMlComponent(block)) {
                    if (
                        block.type === "text" ||
                        block.type === "list" ||
                        block.type === "heading"
                    ) {
                        text.push(block)
                    }
                }
            }
            const callout: EnrichedBlockCallout = {
                type: "callout",
                text,
                parseErrors: [],
            }

            return {
                errors: [],
                content: [callout],
            }
        })
        .with("owid/key-insight", () => {
            const title = get(details, "attributes.title", "") as string
            const text: OwidEnrichedGdocBlock[] = []
            for (const block of content.content) {
                if (
                    isArchieMlComponent(block) &&
                    block.type !== "image" &&
                    block.type !== "chart"
                ) {
                    text.push(block)
                }
            }
            const keyInsightSlide = {
                title,
                type: "key-insight-slide",
                content: text,
                // Casting as any because this isn't a complete OwidEnrichedGdocBlock - it's only valid inside a key-insights block
                // So it doesn't have all the properties of a regular block, and adding them would require supporting it
                // throughout the entire pipeline
            } as any
            const chartOrImage = content.content.find((block) => {
                return (
                    isArchieMlComponent(block) &&
                    (block.type === "chart" || block.type === "image")
                )
            }) as EnrichedBlockChart | EnrichedBlockImage | undefined
            if (chartOrImage) {
                if (chartOrImage.type === "chart") {
                    keyInsightSlide["url"] = chartOrImage.url
                }
                if (chartOrImage.type === "image") {
                    keyInsightSlide["filename"] = chartOrImage.filename
                }
            }

            return {
                errors: [],
                content: [keyInsightSlide],
            }
        })
        .with("owid/key-insights-slider", () => {
            const heading = get(
                details,
                "attributes.title",
                "Key insights"
            ) as string
            const insights: EnrichedBlockKeyInsightsSlide[] = []
            const errors: BlockParseError[] = []
            function isKeyInsightSlide(
                block: unknown
            ): block is EnrichedBlockKeyInsightsSlide {
                return (
                    checkIsPlainObjectWithGuard(block) &&
                    block["type"] === "key-insight-slide"
                )
            }
            for (const block of content.content) {
                if (isKeyInsightSlide(block)) {
                    insights.push(block)
                } else {
                    errors.push({
                        name: "unknown content type inside key-insights block insights array",
                        details: `Expected key-insight-slide, got ${block}`,
                    })
                }
            }
            const keyInsightBlock: EnrichedBlockKeyInsights = {
                type: "key-insights",
                heading,
                insights,
                parseErrors: [],
            }
            return {
                errors,
                content: [keyInsightBlock],
            }
        })
        .with("owid/card", () => {
            if (!details.attributes) {
                return {
                    errors: [
                        {
                            name: "card missing attributes",
                            details: `Card is missing attributes`,
                        } as BlockParseError,
                    ],
                    content: [],
                }
            }
            const { title, linkUrl, mediaUrl } = details.attributes as {
                title?: string
                linkUrl?: string
                mediaUrl?: string
            }
            if (!linkUrl || !title) {
                return {
                    errors: [
                        {
                            name: "card missing title or linkUrl",
                            details: `Card is missing title or linkUrl`,
                        } as BlockParseError,
                    ],
                    content: [],
                }
            }

            const filename = mediaUrl?.split("/").pop()
            let subtitle = ""
            let authors: string[] = []

            // Either it's a card with only authors, or a card with a subtitle and authors
            if (content.content.length === 1) {
                const firstBlock = content.content[0]
                if (isEnrichedTextBlock(firstBlock)) {
                    authors = spansToSimpleString(firstBlock.value).split(", ")
                }
            } else if (content.content.length === 2) {
                const firstBlock = content.content[0]
                const secondBlock = content.content[1]
                if (isEnrichedTextBlock(firstBlock)) {
                    subtitle = spansToSimpleString(firstBlock.value)
                }
                if (isEnrichedTextBlock(secondBlock)) {
                    authors = spansToSimpleString(secondBlock.value).split(", ")
                }
            }

            // Casting as any because this isn't a complete OwidEnrichedGdocBlock - it's only valid inside a research-and-writing block
            // So it doesn't have all the properties of a regular block, and adding them would require supporting it
            // throughout the entire pipeline
            const link = {
                value: {
                    url: linkUrl,
                    authors,
                    title,
                    subtitle,
                    filename: filename,
                },
            } as any
            return {
                errors: [],
                content: [link],
            }
        })
        .with("owid/research-and-writing", () => {
            function isResearchAndWritingLink(
                block: unknown
            ): block is EnrichedBlockResearchAndWritingLink {
                return (
                    checkIsPlainObjectWithGuard(block) &&
                    "value" in block &&
                    checkIsPlainObjectWithGuard(block["value"])
                )
            }

            const primary: EnrichedBlockResearchAndWritingLink[] = []
            const secondary: EnrichedBlockResearchAndWritingLink[] = []
            let more: EnrichedBlockResearchAndWritingRow | undefined = undefined
            const rows: EnrichedBlockResearchAndWritingRow[] = []
            let heading = ""

            let isInMoreSection = false
            const moreSectionArticleBlocks: (
                | EnrichedBlockText
                | EnrichedBlockHeading
            )[] = []

            for (let i = 0; i < content.content.length; i++) {
                const block = content.content[i]

                if (isResearchAndWritingLink(block)) {
                    if (rows.length) {
                        rows[rows.length - 1].articles.push(block)
                    } else if (primary.length === 0 && block.value.subtitle) {
                        primary.push(block)
                    } else if (secondary.length <= 2 && block.value.subtitle) {
                        secondary.push(block)
                    }
                    continue
                }

                if (!isArchieMlComponent(block)) {
                    continue
                }

                const isMoreSectionBlock =
                    block.type === "text" ||
                    (block.type === "heading" && block.level === 6)

                if (isInMoreSection && isMoreSectionBlock) {
                    moreSectionArticleBlocks.push(block)
                } else {
                    // If we're in the more section and we've hit a heading, we're done with the more section
                    isInMoreSection = false
                }

                if (block.type === "heading") {
                    if (i === 0) {
                        heading = spansToSimpleString(block.text)
                    }
                    // The only h5 in this context is the "More" section
                    else if (block.level === 5) {
                        isInMoreSection = true
                        more = {
                            heading: spansToSimpleString(block.text),
                            articles: [],
                        }
                    } else if (block.level === 4) {
                        rows.push({
                            heading: spansToSimpleString(block.text),
                            articles: [],
                        })
                    }
                }
            }

            // Once we've iterated through all the blocks, we can parse the more section
            if (more) {
                for (let i = 0; i < moreSectionArticleBlocks.length; i += 2) {
                    const heading = moreSectionArticleBlocks[i]
                    let url = ""
                    let title = ""
                    if (heading.type === "heading") {
                        if (heading.text.length === 1) {
                            const span = heading.text[0]
                            if (span.spanType === "span-link") {
                                url = span.url
                                if (span.children.length === 1) {
                                    title = spansToSimpleString(span.children)
                                }
                            }
                        }
                    }

                    const authorsBlock = moreSectionArticleBlocks[i + 1]
                    const authors: string[] = []
                    if (authorsBlock.type === "text") {
                        authors.push(
                            ...spansToSimpleString(authorsBlock.value).split(
                                ", "
                            )
                        )
                    }
                    const moreArticleBlock: EnrichedBlockResearchAndWritingLink =
                        {
                            value: {
                                url,
                                authors,
                                title,
                                filename: "",
                            },
                        }
                    more.articles.push(moreArticleBlock)
                }
            }

            const researchAndWriting: EnrichedBlockResearchAndWriting = {
                type: "research-and-writing",
                heading,
                primary,
                secondary,
                rows,
                more,
                parseErrors: [],
                "hide-authors": false,
            }

            return {
                errors: [],
                content: [researchAndWriting],
            }
        })
        .with("owid/all-charts", () => {
            const allCharts: EnrichedBlockAllCharts = {
                type: "all-charts",
                heading: "All charts",
                top: [],
                parseErrors: [],
            }
            return {
                errors: [],
                content: [allCharts],
            }
        })
        .otherwise(() => {
            return {
                errors: [
                    ...content.errors,
                    {
                        name: "unexpected wp component tag",
                        details: `Found unhandled wp:comment tag ${details.tagName}`,
                    },
                ],
                content: content.content,
            }
        })
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
