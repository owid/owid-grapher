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
} from "@ourworldindata/utils"
import { match } from "ts-pattern"
import { compact, partition } from "lodash"
import * as cheerio from "cheerio"

function spanFallback(node: CheerioElement): SpanFallback {
    return {
        spanType: "span-fallback",
        children: compact(node.children?.map(cheerioToSpan)) ?? [],
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
    const nodes = $("body").contents().toArray()
    return compact(nodes.map(cheerioToSpan)) ?? []
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
            .with("a", (): SpanLink | SpanRef => {
                const url = node.attribs.href
                const className = node.attribs.class
                const children =
                    compact(node.children?.map(cheerioToSpan)) ?? []
                if (className === "ref") {
                    return { spanType: "span-ref", children, url }
                }
                return { spanType: "span-link", children, url }
            })
            .with("b", (): SpanBold => {
                const children =
                    compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-bold", children }
            })
            .with("i", (): SpanItalic => {
                const children =
                    compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-italic", children }
            })
            .with("br", (): Span => ({ spanType: "span-newline" }))
            .with("cite", () => spanFallback(node))
            .with("code", () => spanFallback(node)) // TODO: should get a style
            .with(
                "em",
                (): SpanItalic => ({
                    spanType: "span-italic",
                    children: compact(node.children?.map(cheerioToSpan)) ?? [],
                })
            )
            .with(
                "q",
                (): SpanQuote => ({
                    spanType: "span-quote",
                    children: compact(node.children?.map(cheerioToSpan)) ?? [],
                })
            )
            .with("small", () => spanFallback(node))
            .with("span", () => spanFallback(node))
            .with("strong", (): SpanBold => {
                const children =
                    compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-bold", children }
            })
            .with("sup", (): SpanSuperscript => {
                const children =
                    compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-superscript", children }
            })
            .with("sub", (): SpanSubscript => {
                const children =
                    compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-subscript", children }
            })
            .with("u", (): SpanUnderline => {
                const children =
                    compact(node.children?.map(cheerioToSpan)) ?? []
                return { spanType: "span-underline", children }
            })
            .with("wbr", () => spanFallback(node))
            .otherwise(() => {
                return undefined
            })
    }
    return undefined
}
