import {
    OwidRawArticleBlock,
    Span,
    RawBlockHeader,
    EnrichedBlockText,
    OwidEnrichedArticleBlock,
    SpanLink,
    SpanBold,
    SpanItalic,
    SpanFallback,
    SpanQuote,
    SpanSuperscript,
    SpanSubscript,
    SpanUnderline,
    RawBlockRecirc,
    EnrichedBlockSimpleText,
    SpanSimpleText,
    RawBlockAside,
    RawBlockChart,
    RawBlockChartStory,
    RawBlockFixedGraphic,
    RawBlockHorizontalRule,
    RawBlockHtml,
    RawBlockImage,
    RawBlockList,
    RawBlockPosition,
    RawBlockPullQuote,
    RawBlockScroller,
    RawBlockSDGGrid,
    RawBlockText,
    RawBlockUrl,
} from "@ourworldindata/utils"
import { match } from "ts-pattern"
import _, { partition } from "lodash"
import * as cheerio from "cheerio"

function appendDotEndIfMultiline(line: string): string {
    if (line.includes("\n")) return line + "\n.end"
    return line
}

export function keyValueToArchieMlString(
    key: string,
    val: string | undefined
): string {
    if (val !== undefined) return `${key}: ${appendDotEndIfMultiline(val)}`
    return ""
}

// The Record<string, any> here is not ideal - it would be nicer to
// restrict the field type to string but then it only works if all
// fields are strings. Maybe there is some TS magic to do this?
function* propertyToArchieMLString<T extends Record<string, any>>(
    key: keyof T,
    value: T | undefined
): Generator<string, void, undefined> {
    if (value !== undefined)
        if (typeof value === "string") {
            // This is a case where the user gave a string value instead of an object
            // We assume that this was an error here. Not handling this here would make
            // the serialization code below more complex.
        } else yield `${key}: ${appendDotEndIfMultiline(value[key])}`
}

function* rawBlockAsideToArchieMLString(
    block: RawBlockAside
): Generator<string, void, undefined> {
    yield "{.aside}"
    if (typeof block.value !== "string") {
        yield* propertyToArchieMLString("position", block.value)
        yield* propertyToArchieMLString("caption", block.value)
    }
    yield "{}"
}

function* rawBlockChartToArchieMLString(
    block: RawBlockChart
): Generator<string, void, undefined> {
    yield "{.chart}"
    if (typeof block.value !== "string") {
        yield* propertyToArchieMLString("url", block.value)
        yield* propertyToArchieMLString("height", block.value)
        yield* propertyToArchieMLString("row", block.value)
        yield* propertyToArchieMLString("column", block.value)
        yield* propertyToArchieMLString("position", block.value)
        yield* propertyToArchieMLString("caption", block.value)
    }
    yield "{}"
}

function* rawBlockScrollerToArchieMLString(
    block: RawBlockScroller
): Generator<string, void, undefined> {
    yield "[.+scroller]"
    if (typeof block.value !== "string")
        for (const b of block.value)
            yield* owidRawArticleBlockToArchieMLStringGenerator(b)
    yield "[]"
}

function* rawBlockChartStoryToArchieMLString(
    block: RawBlockChartStory
): Generator<string, void, undefined> {
    yield "[.chart-story]"
    if (typeof block.value !== "string") {
        for (const item of block.value) {
            yield* propertyToArchieMLString("narrative", item)
            yield* propertyToArchieMLString("chart", item)
            // TODO: we might need to reverse some regex sanitization here (e.g. colons?)
            yield* item.technical || []
        }
    }
    yield "[]"
}

function* rawBlockFixedGraphicToArchieMLString(
    block: RawBlockFixedGraphic
): Generator<string, void, undefined> {
    yield "[.+fixed-graphic]"
    if (typeof block.value !== "string") {
        for (const b of block.value)
            yield* owidRawArticleBlockToArchieMLStringGenerator(b)
    }
    yield "[]"
}

function* rawBlockImageToArchieMLString(
    block: RawBlockImage
): Generator<string, void, undefined> {
    yield "{.image}"
    if (typeof block.value !== "string") {
        yield* propertyToArchieMLString("src", block.value)
        yield* propertyToArchieMLString("caption", block.value)
    }
    yield "{}"
}

function* rawBlockListToArchieMLString(
    block: RawBlockList
): Generator<string, void, undefined> {
    yield "[.list]"
    if (typeof block.value !== "string") yield* block.value
    yield "[]"
}

function* rawBlockPullQuoteToArchieMLString(
    block: RawBlockPullQuote
): Generator<string, void, undefined> {
    yield "[.+pull-quote]"
    if (typeof block.value !== "string")
        for (const b of block.value)
            yield* owidRawArticleBlockToArchieMLStringGenerator(b)
    yield "[]"
}

function* rawBlockHorizontalRuleToArchieMLString(
    _block: RawBlockHorizontalRule
): Generator<string, void, undefined> {
    yield "{.horizontal-rule}"
    yield "{}"
}

function* rawBlockRecircToArchieMLString(
    block: RawBlockRecirc
): Generator<string, void, undefined> {
    yield "[.recirc]"
    if (typeof block.value !== "string") {
        for (const item of block.value) {
            yield* propertyToArchieMLString("title", item)
            if (item.list) {
                yield "[.list]"
                for (const subItem of item.list) {
                    yield* propertyToArchieMLString("author", subItem)
                    yield* propertyToArchieMLString("url", subItem)
                }
                yield "[]"
            }
        }
    }
    yield "[]"
}

function* rawBlockTextToArchieMLString(
    block: RawBlockText
): Generator<string, void, undefined> {
    yield block.value
}

function* rawBlockHtmlToArchieMLString(
    block: RawBlockHtml
): Generator<string, void, undefined> {
    yield block.value
}

function* rawBlockUrlToArchieMLString(
    block: RawBlockUrl
): Generator<string, void, undefined> {
    yield keyValueToArchieMlString("url", block.value)
}

function* rawBlockPositionToArchieMLString(
    block: RawBlockPosition
): Generator<string, void, undefined> {
    yield keyValueToArchieMlString("url", block.value)
}

function* rawBlockHeaderToArchieMLString(
    block: RawBlockHeader
): Generator<string, void, undefined> {
    yield "{.header}"
    if (typeof block.value !== "string") {
        yield* propertyToArchieMLString("text", block.value)
        yield* propertyToArchieMLString("level", block.value)
    }
    yield "{}"
}

function* rawBlockSDGGridToArchieMLString(
    block: RawBlockSDGGrid
): Generator<string, void, undefined> {
    yield "[.sdg-grid]"
    if (typeof block.value !== "string") {
        for (const item of block.value) {
            yield* propertyToArchieMLString("goal", item)
            yield* propertyToArchieMLString("link", item)
        }
    }
    yield "[]"
}

function* owidRawArticleBlockToArchieMLStringGenerator(
    block: OwidRawArticleBlock
): Generator<string, void, undefined> {
    const content = match(block)
        .with({ type: "aside" }, rawBlockAsideToArchieMLString)
        .with({ type: "chart" }, rawBlockChartToArchieMLString)
        .with({ type: "scroller" }, rawBlockScrollerToArchieMLString)
        .with({ type: "chart-story" }, rawBlockChartStoryToArchieMLString)
        .with({ type: "fixed-graphic" }, rawBlockFixedGraphicToArchieMLString)
        .with({ type: "image" }, rawBlockImageToArchieMLString)
        .with({ type: "list" }, rawBlockListToArchieMLString)
        .with({ type: "pull-quote" }, rawBlockPullQuoteToArchieMLString)
        .with(
            { type: "horizontal-rule" },
            rawBlockHorizontalRuleToArchieMLString
        )
        .with({ type: "recirc" }, rawBlockRecircToArchieMLString)
        .with({ type: "text" }, rawBlockTextToArchieMLString)
        .with({ type: "html" }, rawBlockHtmlToArchieMLString)
        .with({ type: "url" }, rawBlockUrlToArchieMLString)
        .with({ type: "position" }, rawBlockPositionToArchieMLString)
        .with({ type: "header" }, rawBlockHeaderToArchieMLString)
        .with({ type: "sdg-grid" }, rawBlockSDGGridToArchieMLString)
        .otherwise(() => [])
    yield* content
}

export function owidRawArticleBlockToArchieMLString(
    block: OwidRawArticleBlock
): string {
    return [...owidRawArticleBlockToArchieMLStringGenerator(block), ""].join(
        "\n"
    )
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

export function spanToHtmlString(s: Span): string {
    return match(s)
        .with({ spanType: "span-simple-text" }, (span) => span.text)
        .with(
            { spanType: "span-link" },
            (span) =>
                `<a href="${span.url}">${spansToHtmlString(span.children)}</a>`
        )
        .with({ spanType: "span-newline" }, () => "</br>")
        .with(
            { spanType: "span-italic" },
            (span) => `<i>${spansToHtmlString(span.children)}</i>`
        )
        .with(
            { spanType: "span-bold" },
            (span) => `<b>${spansToHtmlString(span.children)}</b>`
        )
        .with(
            { spanType: "span-underline" },
            (span) => `<u>${spansToHtmlString(span.children)}</u>`
        )
        .with(
            { spanType: "span-subscript" },
            (span) => `<sub>${spansToHtmlString(span.children)}</sub>`
        )
        .with(
            { spanType: "span-superscript" },
            (span) => `<sup>${spansToHtmlString(span.children)}</sup>`
        )
        .with(
            { spanType: "span-quote" },
            (span) => `<q>${spansToHtmlString(span.children)}</q>`
        )
        .with(
            { spanType: "span-fallback" },
            (span) => `<span>${spansToHtmlString(span.children)}</span>`
        )
        .exhaustive()
}

export function spansToHtmlString(spans: Span[]): string {
    if (spans.length === 0) return ""
    else {
        const result = spans.map(spanToHtmlString).join("")
        return result
    }
}

function spanFallback(node: CheerioElement): SpanFallback {
    return {
        spanType: "span-fallback",
        children: _.compact(node.children?.map(cheerioToSpan)) ?? [],
    }
}

export function htmlToEnrichedTextBlock(html: string): EnrichedBlockText {
    return {
        type: "text",
        value: htmlToSpans(html),
        parseErrors: [],
    }
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
    const nodes = $("body").contents().toArray()
    return _.compact(nodes.map(cheerioToSpan)) ?? []
}

export function cheerioToSpan(node: CheerioElement): Span | undefined {
    if (node.type === "text")
        // The regex replace takes care of the ArchieML escaping of :
        return {
            spanType: "span-simple-text",
            text: node.data?.replace(/\\:/g, ":") ?? "",
        }
    else if (node.type === "tag") {
        return match(node.tagName)
            .with("a", (): SpanLink => {
                const url = node.attribs.href
                const children =
                    _.compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-link", children, url }
            })
            .with("b", (): SpanBold => {
                const children =
                    _.compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-bold", children }
            })
            .with("i", (): SpanItalic => {
                const children =
                    _.compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-italic", children }
            })
            .with("br", (): Span => ({ spanType: "span-newline" }))
            .with("cite", () => spanFallback(node))
            .with("code", () => spanFallback(node)) // TODO: should get a style
            .with(
                "em",
                (): SpanItalic => ({
                    spanType: "span-italic",
                    children:
                        _.compact(node.children?.map(cheerioToSpan)) ?? [],
                })
            )
            .with(
                "q",
                (): SpanQuote => ({
                    spanType: "span-quote",
                    children:
                        _.compact(node.children?.map(cheerioToSpan)) ?? [],
                })
            )
            .with("small", () => spanFallback(node))
            .with("span", () => spanFallback(node))
            .with("strong", (): SpanBold => {
                const children =
                    _.compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-bold", children }
            })
            .with("sup", (): SpanSuperscript => {
                const children =
                    _.compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-superscript", children }
            })
            .with("sub", (): SpanSubscript => {
                const children =
                    _.compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-subscript", children }
            })
            .with("u", (): SpanUnderline => {
                const children =
                    _.compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-underline", children }
            })
            .with("wbr", () => spanFallback(node))
            .otherwise(() => {
                return undefined
            })
    }
    return undefined
}
