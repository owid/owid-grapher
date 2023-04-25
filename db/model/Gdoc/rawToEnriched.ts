import {
    BlockPositionChoice,
    ChartPositionChoice,
    compact,
    EnrichedBlockAside,
    EnrichedBlockCallout,
    EnrichedBlockChart,
    EnrichedBlockChartStory,
    EnrichedBlockGraySection,
    EnrichedBlockHeading,
    EnrichedBlockHorizontalRule,
    EnrichedBlockHtml,
    EnrichedBlockImage,
    EnrichedBlockList,
    EnrichedBlockNumberedList,
    EnrichedBlockMissingData,
    EnrichedBlockProminentLink,
    EnrichedBlockPullQuote,
    EnrichedBlockRecirc,
    EnrichedBlockScroller,
    EnrichedBlockSDGGrid,
    EnrichedBlockSDGToc,
    EnrichedBlockAdditionalCharts,
    EnrichedBlockSideBySideContainer,
    EnrichedBlockStickyLeftContainer,
    EnrichedBlockStickyRightContainer,
    EnrichedBlockText,
    EnrichedChartStoryItem,
    EnrichedRecircLink,
    EnrichedScrollerItem,
    EnrichedSDGGridItem,
    isArray,
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
    ParseError,
    partition,
    RawBlockAdditionalCharts,
    RawBlockAside,
    RawBlockCallout,
    RawBlockChart,
    RawBlockChartStory,
    RawBlockGraySection,
    RawBlockHeading,
    RawBlockHtml,
    RawBlockImage,
    RawBlockList,
    RawBlockNumberedList,
    RawBlockProminentLink,
    RawBlockPullQuote,
    RawBlockRecirc,
    RawBlockScroller,
    RawBlockSDGGrid,
    RawBlockSideBySideContainer,
    RawBlockStickyLeftContainer,
    RawBlockStickyRightContainer,
    RawBlockText,
    Span,
    SpanSimpleText,
    omitUndefinedValues,
    EnrichedBlockSimpleText,
    checkIsInternalLink,
    BlockImageSize,
    checkIsBlockImageSize,
    RawBlockTopicPageIntro,
    EnrichedBlockTopicPageIntro,
    Url,
    EnrichedTopicPageIntroRelatedTopic,
} from "@ourworldindata/utils"
import { extractUrl, getTitleSupertitleFromHeadingText } from "./gdocUtils.js"
import {
    htmlToEnrichedTextBlock,
    htmlToSimpleTextBlock,
    htmlToSpans,
} from "./htmlToEnriched.js"
import { match } from "ts-pattern"
import { parseInt } from "lodash"

export function parseRawBlocksToEnrichedBlocks(
    block: OwidRawGdocBlock
): OwidEnrichedGdocBlock | null {
    return match(block)
        .with({ type: "additional-charts" }, parseAdditionalCharts)
        .with({ type: "aside" }, parseAside)
        .with({ type: "callout" }, parseCallout)
        .with({ type: "chart" }, parseChart)
        .with({ type: "scroller" }, parseScroller)
        .with({ type: "chart-story" }, parseChartStory)
        .with({ type: "image" }, parseImage)
        .with({ type: "list" }, parseList)
        .with({ type: "numbered-list" }, parseNumberedList)
        .with({ type: "pull-quote" }, parsePullQuote)
        .with(
            { type: "horizontal-rule" },
            (b): EnrichedBlockHorizontalRule => ({
                type: "horizontal-rule",
                value: b.value,
                parseErrors: [],
            })
        )
        .with({ type: "recirc" }, parseRecirc)
        .with({ type: "text" }, parseText)
        .with(
            { type: "html" },
            (block: RawBlockHtml): EnrichedBlockHtml => ({
                type: "html",
                value: block.value,
                parseErrors: [],
            })
        )
        .with({ type: "url" }, () => null) // url blocks should only occur inside of chart stories etc
        .with({ type: "position" }, () => null) // position blocks should only occur inside of chart stories etc
        .with({ type: "heading" }, parseHeading)
        .with({ type: "sdg-grid" }, parseSdgGrid)
        .with({ type: "sticky-left" }, parseStickyLeft)
        .with({ type: "sticky-right" }, parseStickyRight)
        .with({ type: "side-by-side" }, parseSideBySide)
        .with({ type: "gray-section" }, parseGraySection)
        .with({ type: "prominent-link" }, parseProminentLink)
        .with({ type: "topic-page-intro" }, parseTopicPageIntro)
        .with(
            { type: "sdg-toc" },
            (b): EnrichedBlockSDGToc => ({
                type: "sdg-toc",
                value: b.value,
                parseErrors: [],
            })
        )
        .with(
            { type: "missing-data" },
            (b): EnrichedBlockMissingData => ({
                type: "missing-data",
                value: b.value,
                parseErrors: [],
            })
        )
        .exhaustive()
}

function parseAdditionalCharts(
    raw: RawBlockAdditionalCharts
): EnrichedBlockAdditionalCharts {
    const createError = (error: ParseError): EnrichedBlockAdditionalCharts => ({
        type: "additional-charts",
        items: [],
        parseErrors: [error],
    })

    if (!isArray(raw.value))
        return createError({ message: "Value is not a list" })

    const items = raw.value.map(htmlToSpans)

    return {
        type: "additional-charts",
        items,
        parseErrors: [],
    }
}

const parseAside = (raw: RawBlockAside): EnrichedBlockAside => {
    const createError = (
        error: ParseError,
        caption: Span[] = [],
        position: BlockPositionChoice | undefined = undefined
    ): EnrichedBlockAside => ({
        type: "aside",
        caption,
        position,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    if (!raw.value.caption)
        return createError({
            message: "Caption property is missing",
        })

    const position =
        raw.value.position === "left" || raw.value.position === "right"
            ? raw.value.position
            : undefined
    const caption = htmlToSpans(raw.value.caption)

    return {
        type: "aside",
        caption,
        position,
        parseErrors: [],
    }
}

const parseChart = (raw: RawBlockChart): EnrichedBlockChart => {
    const createError = (
        error: ParseError,
        url: string,
        caption: Span[] = []
    ): EnrichedBlockChart => ({
        type: "chart",
        url,
        caption,
        parseErrors: [error],
    })

    const val = raw.value

    if (typeof val === "string") {
        return {
            type: "chart",
            url: val,
            parseErrors: [],
        }
    } else {
        if (!val.url)
            return createError(
                {
                    message: "url property is missing",
                },
                ""
            )

        const url = extractUrl(val.url)

        const warnings: ParseError[] = []

        const height = val.height
        const row = val.row
        const column = val.column
        // This property is currently unused, a holdover from @mathisonian's gdocs demo.
        // We will decide soon™️ if we want to use it for something
        let position: ChartPositionChoice | undefined = undefined
        if (val.position)
            if (val.position === "featured") position = val.position
            else {
                warnings.push({
                    message: "position must be 'featured' or unset",
                })
            }
        const caption = val.caption ? htmlToSpans(val.caption) : []

        return omitUndefinedValues({
            type: "chart",
            url,
            height,
            row,
            column,
            position,
            caption: caption.length > 0 ? caption : undefined,
            parseErrors: [],
        }) as EnrichedBlockChart
    }
}

const parseScroller = (raw: RawBlockScroller): EnrichedBlockScroller => {
    const createError = (
        error: ParseError,
        blocks: EnrichedScrollerItem[] = []
    ): EnrichedBlockScroller => ({
        type: "scroller",
        blocks,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    const blocks: EnrichedScrollerItem[] = []
    let currentBlock: EnrichedScrollerItem = {
        url: "",
        type: "enriched-scroller-item",
        text: { type: "text", value: [], parseErrors: [] },
    }
    const warnings: ParseError[] = []
    for (const block of raw.value) {
        match(block)
            .with({ type: "url" }, (url) => {
                if (currentBlock.url !== "") {
                    blocks.push(currentBlock)
                    currentBlock = {
                        type: "enriched-scroller-item",
                        url: "",
                        text: {
                            type: "text",
                            value: [],
                            parseErrors: [],
                        },
                    }
                }
                currentBlock.url = url.value
            })
            .with({ type: "text" }, (text) => {
                currentBlock.text = htmlToEnrichedTextBlock(text.value)
            })
            .otherwise(() =>
                warnings.push({
                    message: "scroller items must be of type 'url' or 'text'",
                    isWarning: true,
                })
            )
    }
    if (currentBlock.url !== "") {
        blocks.push(currentBlock)
    }

    return {
        type: "scroller",
        blocks,
        parseErrors: [],
    }
}

const parseChartStory = (raw: RawBlockChartStory): EnrichedBlockChartStory => {
    const createError = (
        error: ParseError,
        items: EnrichedChartStoryItem[] = []
    ): EnrichedBlockChartStory => ({
        type: "chart-story",
        items,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    const items: (EnrichedChartStoryItem | ParseError)[] = raw.value.map(
        (item): EnrichedChartStoryItem | ParseError => {
            const chart = item?.chart
            if (typeof item?.narrative !== "string" || item?.narrative === "")
                return {
                    message:
                        "Item is missing narrative property or it is not a string value",
                }
            if (typeof chart !== "string" || item?.chart === "")
                return {
                    message:
                        "Item is missing chart property or it is not a string value",
                }
            return {
                narrative: htmlToEnrichedTextBlock(item.narrative),
                chart: { type: "chart", url: chart, parseErrors: [] },
                technical: item.technical
                    ? item.technical.map(htmlToEnrichedTextBlock)
                    : [],
            }
        }
    )

    const [errors, enrichedItems] = partition(
        items,
        (item): item is ParseError => "message" in item
    )

    return {
        type: "chart-story",
        items: enrichedItems,
        parseErrors: errors,
    }
}

const parseImage = (image: RawBlockImage): EnrichedBlockImage => {
    const createError = (
        error: ParseError,
        filename: string = "",
        alt: string = "",
        caption?: Span[],
        size: BlockImageSize = BlockImageSize.Wide
    ): EnrichedBlockImage => ({
        type: "image",
        filename,
        alt,
        caption,
        size,
        originalWidth: undefined,
        parseErrors: [error],
    })

    const filename = image.value.filename
    if (!filename) {
        return createError({
            message: "filename property is missing or empty",
        })
    }

    // Default to wide
    const size = image.value.size ?? BlockImageSize.Wide
    if (!checkIsBlockImageSize(size)) {
        return createError({
            message: `Invalid size property: ${size}`,
        })
    }

    const caption = image.value.caption
        ? htmlToSpans(image.value.caption)
        : undefined

    return {
        type: "image",
        filename,
        alt: image.value.alt,
        caption,
        size,
        originalWidth: undefined,
        parseErrors: [],
    }
}

const parseNumberedList = (
    raw: RawBlockNumberedList
): EnrichedBlockNumberedList => {
    const createError = (
        error: ParseError,
        items: EnrichedBlockText[] = []
    ): EnrichedBlockNumberedList => ({
        type: "numbered-list",
        items,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not a list of strings",
        })

    // ArchieML only has lists, not numbered lists. By convention,
    const valuesWithoutLeadingNumbers = raw.value.map((val) =>
        val.replace(/^\s*\d+\.\s*/, "")
    )
    const items = valuesWithoutLeadingNumbers.map(htmlToEnrichedTextBlock)

    return {
        type: "numbered-list",
        items,
        parseErrors: [],
    }
}

const parseList = (raw: RawBlockList): EnrichedBlockList => {
    const createError = (
        error: ParseError,
        items: EnrichedBlockText[] = []
    ): EnrichedBlockList => ({
        type: "list",
        items,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not a list of strings",
        })

    const items = raw.value.map(htmlToEnrichedTextBlock)

    return {
        type: "list",
        items,
        parseErrors: [],
    }
}

// const parseSimpleTextsWithErrors = (
//     raw: string[]
// ): { errors: ParseError[]; texts: SpanSimpleText[] } => {
//     const parsedAsBlocks = raw.map(htmlToSimpleTextBlock)
//     const errors = parsedAsBlocks.flatMap((block) => block.parseErrors)
//     const texts = parsedAsBlocks.map((block) => block.value)
//     return { errors, texts }
// }

const parsePullQuote = (raw: RawBlockPullQuote): EnrichedBlockPullQuote => {
    const createError = (
        error: ParseError,
        text: SpanSimpleText[] = []
    ): EnrichedBlockPullQuote => ({
        type: "pull-quote",
        text,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not a list of strings",
        })

    const textResults = compact(raw.value.map(parseRawBlocksToEnrichedBlocks))

    const [textBlocks, otherBlocks] = partition(
        textResults,
        (item): item is EnrichedBlockText => item.type === "text"
    )

    const otherBlockErrors = otherBlocks
        .map((block) => block.parseErrors)
        .flat()
    const textBlockErrors = textBlocks.map((block) => block.parseErrors).flat()

    const simpleTextSpans: SpanSimpleText[] = []
    const unexpectedTextSpanErrors: ParseError[] = []

    for (const textBlock of textBlocks)
        for (const span of textBlock.value) {
            if (span.spanType === "span-simple-text") {
                simpleTextSpans.push(span)
            } else {
                unexpectedTextSpanErrors.push({
                    message:
                        "Unexpected span type in pull-quote. Note: formatting is not supported inside pull-quotes ATM.",
                })
            }
        }

    return {
        type: "pull-quote",
        text: simpleTextSpans,
        parseErrors: [
            ...otherBlockErrors,
            ...textBlockErrors,
            ...unexpectedTextSpanErrors,
        ],
    }
}

const parseRecirc = (raw: RawBlockRecirc): EnrichedBlockRecirc => {
    const createError = (
        error: ParseError,
        title: SpanSimpleText = { spanType: "span-simple-text", text: "" },
        links: EnrichedRecircLink[] = []
    ): EnrichedBlockRecirc => ({
        type: "recirc",
        title,
        links,
        parseErrors: [error],
    })

    if (!raw.value?.title) {
        return createError({
            message: "Recirc must have a title",
        })
    }

    if (!raw.value?.links || !raw.value?.links.length) {
        return createError({
            message: "Recirc must have at least one link",
        })
    }

    const linkErrors: ParseError[] = []
    for (const link of raw.value.links) {
        if (!link.url) {
            linkErrors.push({
                message: "Recirc link missing url property",
            })
        } else if (!Url.fromURL(link.url).isGoogleDoc) {
            linkErrors.push({
                message: "External urls are not supported in recirc blocks",
                isWarning: true,
            })
        }
    }

    const parsedTitle = htmlToSimpleTextBlock(raw.value.title)

    return {
        type: "recirc",
        title: parsedTitle.value,
        links: raw.value.links.map((link) => ({
            type: "recirc-link",
            url: link.url!,
        })),
        parseErrors: [...linkErrors],
    }
}

const parseText = (raw: RawBlockText): EnrichedBlockText => {
    const createError = (
        error: ParseError,
        value: Span[] = []
    ): EnrichedBlockText => ({
        type: "text",
        value,
        parseErrors: [error],
    })

    if (typeof raw.value !== "string")
        return createError({
            message: "Value is a not a string",
        })

    const value = htmlToSpans(raw.value)

    return {
        type: "text",
        value,
        parseErrors: [],
    }
}

/** Note that this function is not automatically called from parseRawBlocksToEnrichedBlocks as all
    the others are. SimpleTexts only exist on the Enriched level, not on the raw level, and they
    only make sense when the code requesting a block to be parsed wants to exclude formatting.
    Use this function if you have a RawBlockText and want to try to parse it to a SimpleText.
*/
export const parseSimpleText = (raw: RawBlockText): EnrichedBlockSimpleText => {
    const createError = (
        error: ParseError,
        value: SpanSimpleText = { spanType: "span-simple-text", text: "" }
    ): EnrichedBlockSimpleText => ({
        type: "simple-text",
        value,
        parseErrors: [error],
    })

    if (typeof raw.value !== "string")
        return createError({
            message: "Value is a not a string but a " + typeof raw.value,
        })

    return htmlToSimpleTextBlock(raw.value)
}

const parseHeading = (raw: RawBlockHeading): EnrichedBlockHeading => {
    const createError = (
        error: ParseError,
        text: Span[] = [{ spanType: "span-simple-text", text: "" }],
        level: number = 1
    ): EnrichedBlockHeading => ({
        type: "heading",
        text,
        level,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    const headingText = raw.value.text
    if (!headingText)
        return createError({
            message: "Text property is missing",
        })
    // TODO: switch headings to not use a vertical tab character.
    // In the SDG pages we use the vertical tab character to separate the title
    // from the supertitle. The spans can be nested and then the correct way of
    // dealing with this would be to first parse the HTML into spans and then
    // check if somewhere in the nested tree there is a vertical tab character,
    // and if so to create two trees where the second mirrors the nesting of
    // the first. For now here we just assume that the vertical tab character
    // is used on the top level only (i.e. not inside an italic span or similar)
    const [title, supertitle] = getTitleSupertitleFromHeadingText(headingText)
    const titleSpans = htmlToSpans(title)
    const superTitleSpans = supertitle ? htmlToSpans(supertitle) : undefined

    if (!raw.value.level)
        return createError({
            message: "Header level property is missing",
        })
    const level = parseInt(raw.value.level, 10)
    if (level < 1 || level > 5)
        return createError({
            message:
                "Header level property is outside the valid range between 1 and 5",
        })

    return {
        type: "heading",
        text: titleSpans,
        supertitle: superTitleSpans,
        level: level,
        parseErrors: [],
    }
}

const parseSdgGrid = (raw: RawBlockSDGGrid): EnrichedBlockSDGGrid => {
    const createError = (
        error: ParseError,
        items: EnrichedSDGGridItem[] = []
    ): EnrichedBlockSDGGrid => ({
        type: "sdg-grid",
        items,
        parseErrors: [error],
    })

    if (typeof raw.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    if (raw.value.length === 0)
        return createError({
            message: "SDG Grid must have at least one item",
        })

    if (!raw.value)
        return createError({
            message: "SDG Grid must have at least one entry",
        })

    const items: (EnrichedSDGGridItem | ParseError[])[] = raw.value.map(
        (item): EnrichedSDGGridItem | ParseError[] => {
            if (typeof item?.goal !== "string")
                return [
                    {
                        message:
                            "Item is missing goal property or it is not a string value",
                    },
                ]
            if (typeof item?.link !== "string")
                return [
                    {
                        message:
                            "Item is missing link property or it is not a string value",
                    },
                ]
            // TODO: make the type not just a string and then parse spans here
            const goal = item.goal!
            const link = item.link!

            //const errors = goal.parseErrors.concat(link.parseErrors)

            //if (errors.length > 0) return errors

            return {
                goal,
                link,
            }
        }
    )

    const [errors, enrichedItems] = partition(
        items,
        (item: EnrichedSDGGridItem | ParseError[]): item is ParseError[] =>
            isArray(item)
    )

    const flattenedErrors = errors.flat()

    return {
        type: "sdg-grid",
        items: enrichedItems,
        parseErrors: [...flattenedErrors],
    }
}

function parseStickyRight(
    raw: RawBlockStickyRightContainer
): EnrichedBlockStickyRightContainer {
    const createError = (
        error: ParseError,
        left: OwidEnrichedGdocBlock[] = [],
        right: OwidEnrichedGdocBlock[] = []
    ): EnrichedBlockStickyRightContainer => ({
        type: "sticky-right",
        left,
        right,
        parseErrors: [error],
    })
    const { left, right } = raw.value
    if (
        left === undefined ||
        right === undefined ||
        !left.length ||
        !right.length
    ) {
        return createError({
            message: "Empty column in the sticky right container",
        })
    }
    const enrichedLeft = compact(left.map(parseRawBlocksToEnrichedBlocks))
    const enrichedRight = compact(right.map(parseRawBlocksToEnrichedBlocks))
    return {
        type: "sticky-right",
        left: enrichedLeft,
        right: enrichedRight,
        parseErrors: [],
    }
}

function parseStickyLeft(
    raw: RawBlockStickyLeftContainer
): EnrichedBlockStickyLeftContainer {
    const createError = (
        error: ParseError,
        left: OwidEnrichedGdocBlock[] = [],
        right: OwidEnrichedGdocBlock[] = []
    ): EnrichedBlockStickyLeftContainer => ({
        type: "sticky-left",
        left,
        right,
        parseErrors: [error],
    })
    const { left, right } = raw.value
    if (
        left === undefined ||
        right === undefined ||
        !left.length ||
        !right.length
    ) {
        return createError({
            message: "Empty column in the sticky left container",
        })
    }
    const enrichedLeft = compact(left.map(parseRawBlocksToEnrichedBlocks))
    const enrichedRight = compact(right.map(parseRawBlocksToEnrichedBlocks))
    return {
        type: "sticky-left",
        left: enrichedLeft,
        right: enrichedRight,
        parseErrors: [],
    }
}

function parseSideBySide(
    raw: RawBlockSideBySideContainer
): EnrichedBlockSideBySideContainer {
    const createError = (
        error: ParseError,
        left: OwidEnrichedGdocBlock[] = [],
        right: OwidEnrichedGdocBlock[] = []
    ): EnrichedBlockSideBySideContainer => ({
        type: "side-by-side",
        left,
        right,
        parseErrors: [error],
    })
    const { left, right } = raw.value
    if (
        left === undefined ||
        right === undefined ||
        !left.length ||
        !right.length
    ) {
        return createError({
            message: "Empty column in the side-by-side container",
        })
    }
    const enrichedLeft = compact(left.map(parseRawBlocksToEnrichedBlocks))
    const enrichedRight = compact(right.map(parseRawBlocksToEnrichedBlocks))
    return {
        type: "side-by-side",
        left: enrichedLeft,
        right: enrichedRight,
        parseErrors: [],
    }
}

function parseGraySection(raw: RawBlockGraySection): EnrichedBlockGraySection {
    return {
        type: "gray-section",
        items: compact(raw.value.map(parseRawBlocksToEnrichedBlocks)),
        parseErrors: [],
    }
}

function parseProminentLink(
    raw: RawBlockProminentLink
): EnrichedBlockProminentLink {
    const createError = (error: ParseError): EnrichedBlockProminentLink => ({
        type: "prominent-link",
        parseErrors: [error],
        title: "",
        url: "",
        description: "",
    })

    const url = extractUrl(raw.value.url)

    if (!url) {
        return createError({ message: "No url given for the prominent link" })
    }

    if (!checkIsInternalLink(url) && !raw.value.title) {
        return createError({
            message:
                "No title given for the prominent link. If the link points to an external source, it must have a title.",
        })
    }

    return {
        type: "prominent-link",
        parseErrors: [],
        title: raw.value.title,
        url,
        description: raw.value.description,
        thumbnail: raw.value.thumbnail,
    }
}

function parseCallout(raw: RawBlockCallout): EnrichedBlockCallout {
    const createError = (error: ParseError): EnrichedBlockCallout => ({
        type: "callout",
        parseErrors: [error],
        title: "",
        text: [],
    })

    if (!raw.value.text) {
        return createError({ message: "No text provided for callout block" })
    }

    if (!isArray(raw.value.text)) {
        return createError({
            message:
                "Text must be provided as an array e.g. inside a [.+text] block",
        })
    }
    const text = raw.value.text.map((text) => htmlToSpans(text.value))

    return {
        type: "callout",
        parseErrors: [],
        text,
        title: raw.value.title,
    }
}

function parseTopicPageIntro(
    raw: RawBlockTopicPageIntro
): EnrichedBlockTopicPageIntro {
    const createError = (error: ParseError): EnrichedBlockTopicPageIntro => ({
        type: "topic-page-intro",
        parseErrors: [error],
        content: [],
    })

    if (!raw.value.content) {
        return createError({
            message: "Missing content",
        })
    }

    const contentErrors: ParseError[] = []
    const textOnlyContent = raw.value.content.filter(
        (element) => element.type === "text"
    )
    if (raw.value.content.length !== textOnlyContent.length) {
        contentErrors.push({
            message:
                "Only paragraphs are supported in topic-page-intro blocks.",
            isWarning: true,
        })
    }

    const downloadButton = raw.value["download-button"]
    if (downloadButton) {
        if (!downloadButton.text) {
            return createError({
                message: "Download button specified but missing text value",
            })
        }

        if (!downloadButton.url) {
            return createError({
                message: "Download button specified but missing url value",
            })
        }
    }

    const enrichedDownloadButton: EnrichedBlockTopicPageIntro["downloadButton"] =
        downloadButton
            ? {
                  ...downloadButton,
                  type: "topic-page-intro-download-button",
              }
            : undefined

    const relatedTopics = raw.value["related-topics"]
    const enrichedRelatedTopics: EnrichedTopicPageIntroRelatedTopic[] = []
    if (relatedTopics) {
        for (const relatedTopic of relatedTopics) {
            if (!relatedTopic.url) {
                return createError({
                    message: "A related topic is missing a url",
                })
            }

            const url = extractUrl(relatedTopic.url)
            const { isGoogleDoc } = Url.fromURL(relatedTopic.url)
            if (!isGoogleDoc && !relatedTopic.text) {
                return createError({
                    message:
                        "A title must be provided for related topics that aren't linked via Gdocs",
                })
            }

            // If we've validated that it's a Gdoc link without a title,
            // or a regular link *with* a title, then we're good to go
            const enrichedRelatedTopic: EnrichedTopicPageIntroRelatedTopic = {
                type: "topic-page-intro-related-topic",
                url,
                text: relatedTopic.text,
            }

            enrichedRelatedTopics.push(enrichedRelatedTopic)
        }
    }

    return {
        type: "topic-page-intro",
        downloadButton: enrichedDownloadButton,
        relatedTopics: enrichedRelatedTopics,
        content: textOnlyContent.map((rawText) =>
            htmlToEnrichedTextBlock(rawText.value)
        ),
        parseErrors: [...contentErrors],
    }
}
