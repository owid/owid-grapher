import * as cheerio from "cheerio"
import { LinkedCallouts, Span, SpanCallout } from "@ourworldindata/types"
import {
    OwidEnrichedGdocBlock,
    checkShouldDataCalloutRender,
    excludeNullish,
    getCalloutValue,
    makeLinkedCalloutKey,
} from "@ourworldindata/utils"
import { match, P } from "ts-pattern"
import { htmlToEnrichedBlocks } from "./htmlToEnriched.js"

export interface IndexableTextConversionOptions {
    linkedCallouts?: LinkedCallouts
    currentDataCalloutUrl?: string
}

function resolveSpanCalloutValue(
    span: SpanCallout,
    options?: IndexableTextConversionOptions
): string | undefined {
    if (!options?.linkedCallouts || !options?.currentDataCalloutUrl) {
        return undefined
    }

    const key = makeLinkedCalloutKey(options.currentDataCalloutUrl)
    const linkedCallout = options.linkedCallouts[key]

    if (!linkedCallout?.values) return undefined

    return getCalloutValue(
        linkedCallout.values,
        span.functionName,
        span.parameters
    )
}

function joinBlocksWithSeparator(
    parts: (string | undefined)[],
    terminator: string,
    separator: string
): string {
    const filtered = excludeNullish(parts)
        .map((part) => part.trim())
        .filter((part) => part.length > 0)

    return filtered.reduce((acc, part) => {
        if (acc === "") return part
        // If `acc` already ends with strong punctuation (optionally followed by
        // closing quotes/brackets, including smart quotes), keep that join as-is
        // to avoid duplicated punctuation such as `..`, `?.`, or `;;`.
        if (/[.!?:;]["')\]”’]*$/.test(acc)) return `${acc}${separator}${part}`
        return `${acc}${terminator}${separator}${part}`
    }, "")
}

function joinBlocksAsParagraphs(parts: (string | undefined)[]): string {
    // Use paragraph boundaries `\n\n` so `chunkParagraphs` can split semantically by
    // paragraph first. If punctuation is missing, `joinBlocksWithSeparator`
    // inserts a period before the separator so text stays sentence-like after
    // `cleanPlaintext` later collapses newlines during chunking.
    return joinBlocksWithSeparator(parts, ".", "\n\n")
}

function joinBlocksAsSentences(
    parts: (string | undefined)[],
    terminator = "."
): string {
    return joinBlocksWithSeparator(parts, terminator, " ")
}

export function enrichedBlocksToIndexableText(
    blocks: OwidEnrichedGdocBlock[] | undefined,
    options?: IndexableTextConversionOptions
): string | undefined {
    if (!blocks) return undefined
    const result = joinBlocksAsParagraphs(
        blocks.map((block) => enrichedBlockToIndexableText(block, options))
    )
    if (result === "") return undefined
    else return result
}

function spanToIndexableText(
    span: Span,
    options?: IndexableTextConversionOptions
): string {
    return match(span)
        .with({ spanType: "span-simple-text" }, (s) => s.text)
        .with({ spanType: "span-ref" }, () => "")
        .with({ spanType: "span-callout" }, (s) => {
            const resolvedValue = resolveSpanCalloutValue(s, options)
            if (resolvedValue) return resolvedValue
            return spansToIndexableText(s.children, options)
        })
        .with(
            {
                spanType: P.union(
                    "span-link",
                    "span-dod",
                    "span-guided-chart-link",
                    "span-italic",
                    "span-bold",
                    "span-underline",
                    "span-subscript",
                    "span-superscript",
                    "span-quote",
                    "span-fallback"
                ),
            },
            (s) => spansToIndexableText(s.children, options)
        )
        .with({ spanType: "span-newline" }, () => " ") // very rare, no need for more complex concatenation logic
        .exhaustive()
}

function spansToIndexableText(
    spans: Span[],
    options?: IndexableTextConversionOptions
): string {
    return spans.map((span) => spanToIndexableText(span, options)).join("")
}

export function enrichedBlockToIndexableText(
    block: OwidEnrichedGdocBlock,
    options?: IndexableTextConversionOptions
): string | undefined {
    // Indexing policy:
    // - Include authored, on-page narrative content and captions.
    // - Recurse through container/layout blocks to reach authored content.
    // - Exclude navigational, promotional, and system/UI placeholder blocks,
    //   especially where block content primarily points to content elsewhere.
    // - Never index link target URLs/metadata from such blocks.
    if (!block.type) return undefined
    return (
        match(block)
            .with({ type: "align" }, (b): string | undefined =>
                enrichedBlocksToIndexableText(b.content, options)
            )
            .with({ type: "aside" }, (b): string | undefined =>
                b.caption ? spansToIndexableText(b.caption, options) : undefined
            )
            .with({ type: "blockquote" }, (b): string | undefined => {
                const quoteText = joinBlocksAsSentences(
                    b.text.map((text) =>
                        enrichedBlockToIndexableText(text, options)
                    )
                )
                return (
                    joinBlocksAsSentences([quoteText, b.citation], ";") ||
                    undefined
                )
            })
            .with({ type: "callout" }, (b): string | undefined => {
                return (
                    joinBlocksAsSentences([
                        b.title,
                        enrichedBlocksToIndexableText(b.text, options),
                    ]) || undefined
                )
            })
            .with({ type: "chart" }, (b): string | undefined =>
                b.caption ? spansToIndexableText(b.caption, options) : undefined
            )
            .with({ type: "chart-story" }, (b): string | undefined => {
                const itemTexts = b.items.map((item) =>
                    joinBlocksAsSentences([
                        enrichedBlockToIndexableText(item.narrative, options),
                        ...item.technical.map((technicalBlock) =>
                            enrichedBlockToIndexableText(
                                technicalBlock,
                                options
                            )
                        ),
                    ])
                )
                return joinBlocksAsSentences(itemTexts) || undefined
            })
            .with(
                { type: "code" },
                (b): string | undefined =>
                    joinBlocksAsSentences(
                        b.text.map((text) => text.value.text)
                    ) || undefined
            )
            .with({ type: "conditional-section" }, (b): string | undefined =>
                enrichedBlocksToIndexableText(b.content, options)
            )
            .with({ type: "data-callout" }, (b): string | undefined => {
                if (!options?.linkedCallouts) return undefined

                const shouldRender = checkShouldDataCalloutRender(
                    b,
                    options.linkedCallouts
                )
                if (!shouldRender) return undefined

                const nestedOptions: IndexableTextConversionOptions = {
                    ...options,
                    currentDataCalloutUrl: b.url,
                }
                return enrichedBlocksToIndexableText(b.content, nestedOptions)
            })
            .with({ type: "expandable-paragraph" }, (b): string | undefined =>
                enrichedBlocksToIndexableText(b.items, options)
            )
            .with(
                { type: "expander" },
                (b): string | undefined =>
                    joinBlocksAsSentences([
                        b.title,
                        enrichedBlocksToIndexableText(b.content, options),
                    ]) || undefined
            )
            .with({ type: "explore-data-section" }, (b): string | undefined =>
                enrichedBlocksToIndexableText(b.content, options)
            )
            .with({ type: "gray-section" }, (b): string | undefined =>
                enrichedBlocksToIndexableText(b.items, options)
            )
            .with({ type: "guided-chart" }, (b): string | undefined =>
                enrichedBlocksToIndexableText(b.content, options)
            )
            .with({ type: "heading" }, (b): string | undefined => {
                const text = b.supertitle
                    ? joinBlocksAsSentences([
                          spansToIndexableText(b.supertitle, options),
                          spansToIndexableText(b.text, options),
                      ])
                    : spansToIndexableText(b.text, options)
                return text
            })
            .with({ type: "html" }, (b): string | undefined => {
                // Only extract text from HTML tables; other HTML blocks are
                // intentionally skipped until a legitimate use case surfaces.
                if (b.value.includes("<table")) {
                    const $ = cheerio.load(b.value)
                    const cells: string[] = []
                    $("td, th").each((_, cell) => {
                        const cellHtml = $(cell).html() ?? ""
                        const blocks = htmlToEnrichedBlocks(cellHtml)
                        const text = enrichedBlocksToIndexableText(
                            blocks,
                            options
                        )
                        if (text) cells.push(text)
                    })
                    return cells.join(" | ") || undefined
                }
                return undefined
            })
            .with({ type: "image" }, (b): string | undefined => {
                const caption = b.caption
                    ? spansToIndexableText(b.caption, options)
                    : undefined
                return joinBlocksAsSentences([b.alt, caption]) || undefined
            })
            .with({ type: "key-indicator" }, (b): string | undefined => {
                return (
                    joinBlocksAsSentences([
                        b.title,
                        enrichedBlocksToIndexableText(b.text, options),
                        b.source,
                    ]) || undefined
                )
            })
            .with(
                { type: "key-indicator-collection" },
                (b): string | undefined =>
                    joinBlocksAsSentences([
                        b.heading,
                        b.subtitle,
                        ...b.blocks.map((childBlock) =>
                            enrichedBlockToIndexableText(childBlock, options)
                        ),
                    ]) || undefined
            )
            .with({ type: "key-insights" }, (b): string | undefined => {
                const insightTexts = b.insights.map((insight) =>
                    joinBlocksAsSentences([
                        insight.title,
                        enrichedBlocksToIndexableText(insight.content, options),
                    ])
                )
                return (
                    joinBlocksAsSentences([b.heading, ...insightTexts]) ||
                    undefined
                )
            })
            .with(
                { type: "list" },
                (b): string | undefined =>
                    joinBlocksAsSentences(
                        b.items.map((item) =>
                            spansToIndexableText(item.value, options)
                        ),
                        ";"
                    ) || undefined
            )
            .with({ type: "narrative-chart" }, (b): string | undefined =>
                b.caption ? spansToIndexableText(b.caption, options) : undefined
            )
            .with(
                { type: "numbered-list" },
                (b): string | undefined =>
                    joinBlocksAsSentences(
                        b.items.map((item) =>
                            spansToIndexableText(item.value, options)
                        ),
                        ";"
                    ) || undefined
            )
            .with(
                { type: "people" },
                (b): string | undefined =>
                    joinBlocksAsSentences(
                        b.items.map((item) =>
                            enrichedBlockToIndexableText(item, options)
                        )
                    ) || undefined
            )
            .with(
                { type: "people-rows" },
                (b): string | undefined =>
                    joinBlocksAsSentences(
                        b.people.map((item) =>
                            enrichedBlockToIndexableText(item, options)
                        )
                    ) || undefined
            )
            .with({ type: "person" }, (b): string | undefined => {
                return (
                    joinBlocksAsSentences([
                        b.name,
                        b.title,
                        enrichedBlocksToIndexableText(b.text, options),
                    ]) || undefined
                )
            })
            .with({ type: "pull-quote" }, (b): string | undefined => {
                const parts = [
                    b.quote,
                    ...b.content.map((contentBlock) =>
                        enrichedBlockToIndexableText(contentBlock, options)
                    ),
                ]
                return joinBlocksAsSentences(parts) || undefined
            })
            .with(
                {
                    type: P.union(
                        "side-by-side",
                        "sticky-left",
                        "sticky-right"
                    ),
                },
                (b): string | undefined => {
                    const left = enrichedBlocksToIndexableText(b.left, options)
                    const right = enrichedBlocksToIndexableText(
                        b.right,
                        options
                    )
                    return joinBlocksAsSentences([left, right]) || undefined
                }
            )
            .with(
                { type: "simple-text" },
                (b): string | undefined => b.value.text
            )
            .with({ type: "static-viz" }, (b): string | undefined =>
                b.caption ? spansToIndexableText(b.caption, options) : undefined
            )
            .with({ type: "table" }, (b): string | undefined => {
                const cells = b.rows.flatMap((row) =>
                    row.cells.map(
                        (cell) =>
                            enrichedBlocksToIndexableText(
                                cell.content,
                                options
                            ) ?? ""
                    )
                )
                const tableText = cells.join(" | ")
                const captionText = b.caption
                    ? spansToIndexableText(b.caption, options)
                    : undefined
                return (
                    joinBlocksAsSentences([tableText, captionText]) || undefined
                )
            })
            .with({ type: "text" }, (b): string | undefined =>
                b.value ? spansToIndexableText(b.value, options) : undefined
            )
            .with({ type: "topic-page-intro" }, (b): string | undefined =>
                enrichedBlocksToIndexableText(b.content, options)
            )
            .with({ type: "video" }, (b): string | undefined =>
                b.caption ? spansToIndexableText(b.caption, options) : undefined
            )
            // Dropped from indexable text: links/nav/promos/UI/system-only.
            .with(
                {
                    type: P.union(
                        "additional-charts",
                        "all-charts",
                        "cookie-notice",
                        "cta",
                        "donors",
                        "entry-summary",
                        "explorer-tiles",
                        "featured-data-insights",
                        "featured-metrics",
                        "homepage-intro",
                        "homepage-search",
                        "horizontal-rule",
                        "latest-data-insights",
                        "ltp-toc",
                        "missing-data",
                        "pill-row",
                        "prominent-link",
                        "recirc",
                        "research-and-writing",
                        "resource-panel",
                        "script",
                        "sdg-grid",
                        "sdg-toc",
                        "socials",
                        "subscribe-banner"
                    ),
                },
                (): undefined => undefined
            )
            .exhaustive()
    )
}
