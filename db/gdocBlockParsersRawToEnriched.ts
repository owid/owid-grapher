import {
    OwidRawArticleBlock,
    OwidArticleContent,
    Span,
    RawBlockHorizontalRule,
    RawBlockImage,
    RawBlockList,
    RawBlockHeader,
    OwidEnrichedArticleBlock,
    EnrichedBlockAside,
    BlockPositionChoice,
    ParseError,
    EnrichedBlockText,
    compact,
    EnrichedBlockChart,
    ChartPositionChoice,
    EnrichedBlockScroller,
    isArray,
    partition,
} from "@ourworldindata/utils"
import {
    htmlToEnrichedTextBlock,
    htmlToSimpleTextBlock,
    htmlToSpans,
    owidRawArticleBlockToArchieMLString,
    spanToHtmlString,
} from "./gdocUtils"
import { match, P } from "ts-pattern"
import {
    EnrichedBlockChartStory,
    EnrichedBlockFixedGraphic,
    EnrichedBlockHeader,
    EnrichedBlockHorizontalRule,
    EnrichedBlockHtml,
    EnrichedBlockImage,
    EnrichedBlockList,
    EnrichedBlockPullQuote,
    EnrichedBlockRecirc,
    EnrichedChartStoryItem,
    EnrichedRecircItem,
    EnrichedScrollerItem,
    RawBlockAside,
    RawBlockChart,
    RawBlockChartStory,
    RawBlockFixedGraphic,
    RawBlockHtml,
    RawBlockPullQuote,
    RawBlockRecirc,
    RawBlockScroller,
    RawBlockText,
    SpanSimpleText,
} from "@ourworldindata/utils/dist/owidTypes.js"
import { parseInt } from "lodash"

export function parseRawBlocksToEnhancedBlocks(
    block: OwidRawArticleBlock
): OwidEnrichedArticleBlock | null {
    return match(block)
        .with({ type: "aside" }, parseAside)
        .with({ type: "chart" }, parseChart)
        .with({ type: "scroller" }, parseScroller)
        .with({ type: "chart-story" }, parseChartStory)
        .with({ type: "fixed-graphic" }, parseFixedGraphic)
        .with({ type: "image" }, parseImage)
        .with({ type: "list" }, parseList)
        .with({ type: "pull-quote" }, parsePullQuote)
        .with(
            { type: "horizontal-rule" },
            (): EnrichedBlockHorizontalRule => ({
                type: "horizontal-rule",
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
        .with({ type: "header" }, parseHeader)
        .exhaustive()
}

const parseAside = (aside: RawBlockAside): EnrichedBlockAside => {
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

    if (typeof aside.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    if (!aside.value.caption)
        return createError({
            message: "Caption property is missing",
        })

    const position =
        aside.value.position === "left" || aside.value.position === "right"
            ? aside.value.position
            : undefined
    const caption = htmlToSpans(aside.value.caption)

    return {
        type: "aside",
        caption,
        position,
        parseErrors: [],
    }
}

const parseChart = (chart: RawBlockChart): EnrichedBlockChart => {
    const createError = (
        error: ParseError,
        url: string,
        height: string | undefined = undefined,
        row: string | undefined = undefined,
        column: string | undefined = undefined,
        position: ChartPositionChoice | undefined = undefined,
        caption: Span[] = []
    ): EnrichedBlockChart => ({
        type: "chart",
        url,
        height,
        row,
        column,
        position,
        caption,
        parseErrors: [error],
    })

    const val = chart.value

    if (typeof val === "string") {
        return {
            type: "chart",
            url: val,
            height: undefined,
            row: undefined,
            column: undefined,
            position: undefined,
            caption: [],
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

        const url = val.url

        const warnings: ParseError[] = []

        const height = val.height ? val.height : undefined
        const row = val.row ? val.row : undefined
        const column = val.column ? val.column : undefined
        let position: ChartPositionChoice | undefined = undefined
        if (val.position)
            if (val.position === "featured") position = val.position
            else {
                warnings.push({
                    message: "position must be 'featured' or unset",
                })
            }
        const caption = val.caption ? htmlToSpans(val.caption) : []

        return {
            type: "chart",
            url,
            height,
            row,
            column,
            position,
            caption,
            parseErrors: [],
        }
    }
}

const parseScroller = (scroller: RawBlockScroller): EnrichedBlockScroller => {
    const createError = (
        error: ParseError,
        blocks: EnrichedScrollerItem[] = []
    ): EnrichedBlockScroller => ({
        type: "scroller",
        blocks,
        parseErrors: [error],
    })

    if (typeof scroller.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    const blocks: EnrichedScrollerItem[] = []
    let currentBlock: EnrichedScrollerItem = {
        url: "",
        text: { type: "text", value: [], parseErrors: [] },
    }
    const warnings: ParseError[] = []
    for (const block of scroller.value) {
        match(block)
            .with({ type: "url" }, (url) => {
                if (currentBlock.url !== "") {
                    blocks.push(currentBlock)
                    currentBlock = {
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

const parseChartStory = (
    chartStory: RawBlockChartStory
): EnrichedBlockChartStory => {
    const createError = (
        error: ParseError,
        items: EnrichedChartStoryItem[] = []
    ): EnrichedBlockChartStory => ({
        type: "chart-story",
        items,
        parseErrors: [error],
    })

    if (typeof chartStory.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    const items: (EnrichedChartStoryItem | ParseError)[] = chartStory.value.map(
        (item): EnrichedChartStoryItem | ParseError => {
            const chart = item?.chart
            if (typeof item?.narrative !== "string")
                return {
                    message:
                        "Item is missing narrative property or it is not a string value",
                }
            if (typeof chart !== "string")
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

const parseFixedGraphic = (
    fixedGraphic: RawBlockFixedGraphic
): EnrichedBlockFixedGraphic => {
    const createError = (
        error: ParseError,
        graphic: EnrichedBlockChart | EnrichedBlockImage = {
            type: "image",
            src: "",
            caption: [],
            parseErrors: [],
        },
        text: EnrichedBlockText[] = [],
        position: BlockPositionChoice | undefined = undefined
    ): EnrichedBlockFixedGraphic => ({
        type: "fixed-graphic",
        graphic,
        text,
        position: position,
        parseErrors: [error],
    })

    if (typeof fixedGraphic.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    let position: BlockPositionChoice | undefined = undefined
    let graphic: EnrichedBlockChart | EnrichedBlockImage | undefined = undefined
    const texts: EnrichedBlockText[] = []
    const warnings: ParseError[] = []
    for (const block of fixedGraphic.value) {
        match(block)
            .with({ type: "chart" }, (chart) => {
                graphic = parseChart(chart)
            })
            .with({ type: "image" }, (chart) => {
                graphic = parseImage(chart)
            })
            .with({ type: "text" }, (text) => {
                texts.push(htmlToEnrichedTextBlock(text.value))
            })
            .with({ type: "position" }, (chart) => {
                if (chart.value === "left" || chart.value === "right")
                    position = chart.value
                else {
                    warnings.push({
                        message: "position must be 'featured' or unset",
                    })
                }
            })
            .otherwise(() =>
                warnings.push({
                    message:
                        "fixed-graphic items must be of type 'chart', 'image', 'text' or 'position'",
                    isWarning: true,
                })
            )
    }
    if (texts.length === 0 || !graphic)
        return createError({
            message: "fixed-graphic must have a position and a graphic",
        })

    return {
        type: "fixed-graphic",
        graphic,
        position,
        text: texts,
        parseErrors: warnings,
    }
}

const parseImage = (image: RawBlockImage): EnrichedBlockImage => {
    const createError = (
        error: ParseError,
        src: string = "",
        caption: Span[] = []
    ): EnrichedBlockImage => ({
        type: "image",
        src,
        caption,
        parseErrors: [error],
    })

    if (typeof image.value === "string") {
        return {
            type: "image",
            src: image.value,
            caption: [],
            parseErrors: [],
        }
    } else {
        const src = image.value.src
        if (!src)
            return createError({
                message: "Src property is missing or empty",
            })

        const caption =
            image.value?.caption !== undefined
                ? htmlToSpans(image.value.caption)
                : []

        return {
            type: "image",
            caption,
            src,
            parseErrors: [],
        }
    }
}

const parseList = (list: RawBlockList): EnrichedBlockList => {
    const createError = (
        error: ParseError,
        items: EnrichedBlockText[] = []
    ): EnrichedBlockList => ({
        type: "list",
        items,
        parseErrors: [error],
    })

    if (typeof list.value === "string")
        return createError({
            message: "Value is a string, not a list of strings",
        })

    const items = list.value.map(htmlToEnrichedTextBlock)

    return {
        type: "list",
        items,
        parseErrors: [],
    }
}

const parseSimpleTextsWithErrors = (
    input: string[]
): { errors: ParseError[]; texts: SpanSimpleText[] } => {
    const parsedAsBlocks = input.map(htmlToSimpleTextBlock)
    const errors = parsedAsBlocks.map((block) => block.parseErrors).flat()
    const texts = parsedAsBlocks.map((block) => block.value)
    return { errors, texts }
}

const parsePullQuote = (
    pullquote: RawBlockPullQuote
): EnrichedBlockPullQuote => {
    const createError = (
        error: ParseError,
        text: SpanSimpleText[] = []
    ): EnrichedBlockPullQuote => ({
        type: "pull-quote",
        text,
        parseErrors: [error],
    })

    if (typeof pullquote.value === "string")
        return createError({
            message: "Value is a string, not a list of strings",
        })

    const textResults = compact(
        pullquote.value.map(parseRawBlocksToEnhancedBlocks)
    )

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

const parseRecirc = (recirc: RawBlockRecirc): EnrichedBlockRecirc => {
    const createError = (
        error: ParseError,
        title: SpanSimpleText,
        items: EnrichedRecircItem[] = []
    ): EnrichedBlockRecirc => ({
        type: "recirc",
        title,
        items,
        parseErrors: [error],
    })

    if (typeof recirc.value === "string")
        return createError(
            {
                message: "Value is a string, not an object with properties",
            },
            { spanType: "span-simple-text", text: "" }
        )

    if (recirc.value.length === 0)
        return createError(
            {
                message: "Recirc must have at least one item",
            },
            { spanType: "span-simple-text", text: "" }
        )

    const title = recirc.value[0].title
    if (!title)
        return createError(
            {
                message: "Title property is missing or empty",
            },
            { spanType: "span-simple-text", text: "" }
        )

    if (!recirc.value[0].list)
        return createError(
            {
                message: "Recirc must have at least one entry",
            },
            { spanType: "span-simple-text", text: "" }
        )

    const items: (EnrichedRecircItem | ParseError[])[] =
        recirc.value[0].list.map((item): EnrichedRecircItem | ParseError[] => {
            if (typeof item?.article !== "string")
                return [
                    {
                        message:
                            "Item is missing article property or it is not a string value",
                    },
                ]
            if (typeof item?.author !== "string")
                return [
                    {
                        message:
                            "Item is missing author property or it is not a string value",
                    },
                ]
            if (typeof item?.url !== "string")
                return [
                    {
                        message:
                            "Item is missing url property or it is not a string value",
                    },
                ]

            const article = htmlToSimpleTextBlock(item.article)
            const author = htmlToSimpleTextBlock(item.author)

            const errors = article.parseErrors.concat(author.parseErrors)

            if (errors.length > 0) return errors

            return {
                url: item.url,
                article: article.value,
                author: author.value,
            }
        })

    const [errors, enrichedItems] = partition(
        items,
        (item: EnrichedRecircItem | ParseError[]): item is ParseError[] =>
            isArray(item)
    )

    const flattenedErrors = errors.flat()
    const parsedTitle = htmlToSimpleTextBlock(title)

    return {
        type: "recirc",
        title: parsedTitle.value,
        items: enrichedItems,
        parseErrors: [...flattenedErrors, ...parsedTitle.parseErrors],
    }
}

const parseText = (text: RawBlockText): EnrichedBlockText => {
    const createError = (
        error: ParseError,
        value: Span[] = []
    ): EnrichedBlockText => ({
        type: "text",
        value,
        parseErrors: [error],
    })

    if (typeof text.value !== "string")
        return createError({
            message: "Value is a not a string",
        })

    const value = htmlToSpans(text.value)

    return {
        type: "text",
        value,
        parseErrors: [],
    }
}

const parseHeader = (header: RawBlockHeader): EnrichedBlockHeader => {
    const createError = (
        error: ParseError,
        text: SpanSimpleText = { spanType: "span-simple-text", text: "" },
        level: number = 1
    ): EnrichedBlockHeader => ({
        type: "header",
        text,
        level,
        parseErrors: [error],
    })

    if (typeof header.value === "string")
        return createError({
            message: "Value is a string, not an object with properties",
        })

    const headerText = header.value.text
    if (!headerText)
        return createError({
            message: "Text property is missing",
        })
    const headerSpans = parseSimpleTextsWithErrors([headerText])

    if (headerSpans.texts.length !== 1)
        return createError({
            message:
                "Text did not result in exactly one simple span - did you apply formatting?",
        })

    if (!header.value.level)
        return createError({
            message: "Header level property is missing",
        })
    const level = parseInt(header.value.level, 10)
    if (level < 1 || level > 6)
        return createError({
            message:
                "Header level property is outside the valid range between 1 and 6",
        })

    return {
        type: "header",
        text: headerSpans.texts[0],
        level: level,
        parseErrors: [],
    }
}
