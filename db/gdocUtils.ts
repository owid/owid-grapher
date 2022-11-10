import {
    OwidRawArticleBlock,
    Span,
    RawBlockHeader,
    EnrichedBlockText,
    RawBlockChartValue,
    RawChartStoryValue,
    OwidEnrichedArticleBlock,
    SpanLink,
    SpanBold,
    SpanItalic,
    SpanFallback,
    SpanQuote,
    SpanSuperscript,
    SpanSubscript,
    SpanUnderline,
    RawBlockRecircValue,
    RawBlockRecirc,
    EnrichedBlockSimpleText,
    SpanSimpleText,
} from "@ourworldindata/utils"
import { match, P } from "ts-pattern"
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

export function* stringPropertiesToArchieMlString(
    properties: [string, string][]
) {
    for (const [k, v] of properties) {
        yield keyValueToArchieMlString(k, v)
    }
}

export function objectBlockToArchieMlString<T>(
    type: string,
    block: T,
    contentSerializer: (block: T) => string
): string {
    return `
{.${type}}
${contentSerializer(block)}
{}
`
}

export function stringOnlyObjectToArchieMlString(obj: {
    type: string
    value: Record<string, string> | string
}): string {
    const val = obj.value
    const serializeFn = () =>
        typeof val === "string"
            ? val
            : [...stringPropertiesToArchieMlString(Object.entries(val))].join(
                  "\n"
              )
    return objectBlockToArchieMlString(obj.type, obj.value, serializeFn)
}

export function singleStringObjectToArchieMlString(obj: {
    type: string
    value: string
}): string {
    return keyValueToArchieMlString(obj.type, obj.value)
}

export function blockListToArchieMlString<T>(
    blockname: string,
    blocks: T[] | string,
    contentSerializer: (block: T) => string,
    isFreeformArray: boolean
): string {
    if (typeof blocks === "string")
        return keyValueToArchieMlString(blockname, blocks)
    const content = blocks.map(contentSerializer).join("\n")
    return `
[.${isFreeformArray ? "+" : ""}${blockname}]
${content}
[]
`
}

export function recircContentToArchieMlString(
    content: RawBlockRecircValue
): string {
    const list = blockListToArchieMlString(
        "list",
        content.list ?? [],
        (b) =>
            [...stringPropertiesToArchieMlString(Object.entries(b))].join("\n"),
        false
    )
    return `
${keyValueToArchieMlString("title", content.title ?? "")}
${list}
`
}

export function recircToArchieMlString(recirc: RawBlockRecirc): string {
    return blockListToArchieMlString(
        recirc.type,
        typeof recirc.value !== "string" ? recirc.value : [],
        recircContentToArchieMlString,
        false
    )
}

export function chartStoryValueToArchieMlString(
    value: RawChartStoryValue
): string {
    const narrative = keyValueToArchieMlString("narrative", value?.narrative)
    const chart = keyValueToArchieMlString("chart", value.chart)
    const technicalText = blockListToArchieMlString(
        "technical",
        value.technical!,
        (line) => `* ${line}`,
        false
    )
    return `
${narrative}
${chart}
${technicalText}
`
}

export function headerToArchieMlString(block: RawBlockHeader): string {
    const val = block.value
    if (typeof val === "string") return keyValueToArchieMlString("header", val)
    return objectBlockToArchieMlString(block.type, block.value, () => {
        return [
            keyValueToArchieMlString("text", val?.text),
            val?.level !== undefined
                ? keyValueToArchieMlString("level", val.level.toString())
                : "",
        ].join("\n")
    })
}

export const owidRawArticleBlockToArchieMLString = (
    block: OwidRawArticleBlock
): string => {
    const content = match(block)
        .with(
            { type: P.union("position", "url", "html", "text") },
            singleStringObjectToArchieMlString
        )
        .with(
            { type: "chart", value: P.string },
            singleStringObjectToArchieMlString
        )
        .with({ type: "chart" }, (b) =>
            stringOnlyObjectToArchieMlString({
                type: "chart",
                value: b.value as unknown as RawBlockChartValue,
            })
        )
        .with(
            { type: P.union("aside", "image") },
            stringOnlyObjectToArchieMlString
        )
        .with({ type: "scroller" }, (b) =>
            blockListToArchieMlString(
                block.type,
                b.value,
                owidRawArticleBlockToArchieMLString,
                true
            )
        )
        .with({ type: "recirc" }, (b) => recircToArchieMlString(b))
        .with({ type: "chart-story" }, (b) =>
            blockListToArchieMlString(
                block.type,
                b.value,
                chartStoryValueToArchieMlString,
                false
            )
        )
        .with({ type: "horizontal-rule" }, (b) =>
            keyValueToArchieMlString(block.type, "<hr/>")
        )
        .with({ type: P.union("pull-quote", "list") }, (b) =>
            blockListToArchieMlString(block.type, b.value, (line) => line, true)
        )
        .with({ type: "header" }, headerToArchieMlString)
        .with({ type: "fixed-graphic" }, (b) =>
            blockListToArchieMlString(
                block.type,
                b.value,
                owidRawArticleBlockToArchieMLString,
                true
            )
        )
        .exhaustive()
    return content
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
