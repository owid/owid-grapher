import * as _ from "lodash-es"
import {
    EnrichedBlockResearchAndWriting,
    Span,
    excludeNullish,
    EnrichedBlockResearchAndWritingLink,
    DATA_INSIGHTS_INDEX_PAGE_SIZE,
    OwidEnrichedGdocBlock,
    traverseEnrichedBlock,
    plaintextCalloutRegex,
} from "@ourworldindata/utils"
import {
    SpanCallout,
    CalloutFunction,
    CALLOUT_FUNCTIONS,
} from "@ourworldindata/types"
import { match, P } from "ts-pattern"
import * as cheerio from "cheerio"

export function spanToSimpleString(s: Span): string {
    return match(s)
        .with({ spanType: "span-simple-text" }, (span) => span.text)
        .with({ spanType: "span-newline" }, () => "\n")
        .with(
            {
                spanType: P.union(
                    "span-link",
                    "span-ref",
                    "span-dod",
                    "span-guided-chart-link",
                    "span-italic",
                    "span-bold",
                    "span-underline",
                    "span-subscript",
                    "span-superscript",
                    "span-quote",
                    "span-fallback",
                    "span-callout"
                ),
            },
            (other) => other.children.map(spanToSimpleString).join("")
        )
        .exhaustive()
}

export function spanToHtmlString(s: Span): string {
    return match(s)
        .with({ spanType: "span-simple-text" }, (span) => span.text)
        .with(
            { spanType: "span-link" },
            (span) =>
                `<a href="${span.url}">${spansToHtmlString(span.children)}</a>`
        )
        .with(
            { spanType: "span-ref" },
            (span) =>
                `<a href="${span.url}" class="ref">${spansToHtmlString(
                    span.children
                )}</a>`
        )
        .with(
            { spanType: "span-dod" },
            (span) =>
                `<span><a href="#dod-${span.id}" data-dod-id="${
                    span.id
                }"  class="dod-span">${spansToHtmlString(
                    span.children
                )}</a></span>`
        )
        .with(
            { spanType: "span-guided-chart-link" },
            (span) =>
                `<a href="#guide:${span.url}" class="guided-chart-link">${spansToHtmlString(
                    span.children
                )}</a>`
        )
        .with({ spanType: "span-newline" }, () => "<br/>")
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
        .with(
            { spanType: "span-callout" },
            (span) => `$${span.functionName}(${span.parameters.join(",")})`
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

export function spansToSimpleString(spans: Span[]): string {
    if (spans.length === 0) return ""
    else {
        const result = spans.map(spanToSimpleString).join("")
        return result
    }
}

// Sometimes Google automatically linkifies a URL.
// We always want the plaintext, not '<a href="www.ourworldindata.org">www.ourworldindata.org</a>'
export function extractPlaintextUrl(html: string = ""): string {
    if (html.trim().startsWith("http")) return html.trim()
    const $ = cheerio.load(html)
    return $("a").text()
}

// When we want the href, not the plaintext
export function extractUrl(html: string = ""): string {
    if (!html) return ""
    if (html.trim().startsWith("http")) return html.trim()
    const $ = cheerio.load(html)
    const target = $("a").attr("href")
    // "google.com" (without http://) won't get extracted here, so fallback to the html
    return target || html
}

export const getTitleSupertitleFromHeadingText = (
    headingText: string
): [string, string | undefined] => {
    const VERTICAL_TAB_CHAR = "\u000b"
    const [beforeSeparator, afterSeparator] =
        headingText.split(VERTICAL_TAB_CHAR)

    return [
        afterSeparator || beforeSeparator,
        afterSeparator ? beforeSeparator : undefined,
    ]
}

export const getAllLinksFromResearchAndWritingBlock = (
    block: EnrichedBlockResearchAndWriting
): EnrichedBlockResearchAndWritingLink[] => {
    const { primary, secondary, more, rows } = block
    const rowArticles = rows.flatMap((row) => row.articles)
    const allLinks = excludeNullish([...primary, ...secondary, ...rowArticles])
    if (more) {
        allLinks.push(...more.articles)
    }
    return allLinks
}

export function parseAuthors(authors?: string): string[] {
    return (authors || "Our World in Data team")
        .split(",")
        .map((author: string) => author.trim())
}

/**
 * Calculate the number of pages needed to display all data insights
 * e.g. if there are 61 data insights and we want to display 20 per page, we need 4 pages
 */
export function calculateDataInsightIndexPageCount(
    publishedDataInsightCount: number
): number {
    return Math.ceil(publishedDataInsightCount / DATA_INSIGHTS_INDEX_PAGE_SIZE)
}

export function extractFilenamesFromBlock(
    item: OwidEnrichedGdocBlock
): string[] {
    const filenames = new Set<string>()
    match(item)
        .with({ type: "image" }, (item) => {
            if (item.filename) filenames.add(item.filename)
            if (item.smallFilename) filenames.add(item.smallFilename)
        })
        .with({ type: "person" }, (item) => {
            if (item.image) filenames.add(item.image)
        })
        .with({ type: "prominent-link" }, (item) => {
            if (item.thumbnail) filenames.add(item.thumbnail)
        })
        .with({ type: "video" }, (item) => {
            if (item.filename) filenames.add(item.filename)
        })
        .with({ type: "research-and-writing" }, (item) => {
            getAllLinksFromResearchAndWritingBlock(item).forEach(
                (link: EnrichedBlockResearchAndWritingLink) => {
                    if (link.value.filename) {
                        filenames.add(link.value.filename)
                    }
                }
            )
        })
        .with({ type: "key-insights" }, (item) => {
            item.insights.forEach((insight) => {
                if (insight.filename) {
                    filenames.add(insight.filename)
                }
            })
        })
        .with(
            {
                type: "homepage-intro",
            },
            (item) => {
                item.featuredWork.forEach((featuredWork) => {
                    if (featuredWork.filename) {
                        filenames.add(featuredWork.filename)
                    }
                })
            }
        )
        .with(
            {
                type: P.union(
                    "additional-charts",
                    "align",
                    "all-charts",
                    "aside",
                    "blockquote",
                    "callout",
                    "chart-story",
                    "chart",
                    "conditional-section",
                    "code",
                    "cookie-notice",
                    "cta",
                    "data-callout",
                    "donors",
                    "entry-summary",
                    "expandable-paragraph",
                    "expander",
                    "explorer-tiles",
                    "featured-metrics",
                    "featured-data-insights",
                    "gray-section",
                    "explore-data-section",
                    "heading",
                    "homepage-search",
                    "horizontal-rule",
                    "html",
                    "script",
                    "key-indicator-collection",
                    "key-indicator",
                    "latest-data-insights",
                    "list",
                    "missing-data",
                    "narrative-chart",
                    "numbered-list",
                    "people",
                    "people-rows",
                    "pill-row",
                    "pull-quote",
                    "guided-chart",
                    "recirc",
                    "subscribe-banner",
                    "resource-panel",
                    "sdg-grid",
                    "sdg-toc",
                    "ltp-toc",
                    "side-by-side",
                    "simple-text",
                    "socials",
                    "static-viz",
                    "sticky-left",
                    "sticky-right",
                    "table",
                    "text",
                    "topic-page-intro",
                    "data-callout",
                    "country-profile-selector"
                ),
            },
            _.noop
        )
        .exhaustive()
    return [...filenames]
}

/**
 * Transforms plaintext callout tokens (e.g. $latestValue(shortName), $latestTime(shortName))
 * into SpanCallout spans within a span tree.
 */
function transformCalloutTokensInSpan(span: Span): Span[] {
    // For spans with children, recursively transform children
    if ("children" in span && span.children) {
        const transformedChildren = span.children.flatMap(
            transformCalloutTokensInSpan
        )
        return [{ ...span, children: transformedChildren } as Span]
    }

    // Only process simple text spans
    if (span.spanType !== "span-simple-text") {
        return [span]
    }

    const text = span.text
    const result: Span[] = []
    let lastIndex = 0

    // Reset regex state for each call (global regex maintains state)
    plaintextCalloutRegex.lastIndex = 0

    for (const match of text.matchAll(plaintextCalloutRegex)) {
        const matchIndex = match.index!
        // Add text before match
        if (matchIndex > lastIndex) {
            result.push({
                spanType: "span-simple-text",
                text: text.slice(lastIndex, matchIndex),
            })
        }

        const functionName = match[1]
        const paramString = match[2]

        // Only create SpanCallout for valid function names
        if (CALLOUT_FUNCTIONS.includes(functionName as CalloutFunction)) {
            const calloutSpan: SpanCallout = {
                spanType: "span-callout",
                functionName: functionName as CalloutFunction,
                parameters: paramString ? [paramString] : [],
                children: [],
            }
            result.push(calloutSpan)
        } else {
            // If not a valid function name, keep the original text
            result.push({
                spanType: "span-simple-text",
                text: match[0],
            })
        }

        lastIndex = matchIndex + match[0].length
    }

    // Add remaining text after last match
    if (lastIndex < text.length) {
        result.push({
            spanType: "span-simple-text",
            text: text.slice(lastIndex),
        })
    }

    // If no matches were found, return original span
    return result.length === 0 ? [span] : result
}

/**
 * Transforms plaintext callout tokens in all text blocks within an enriched block tree.
 * Mutates the input block.
 */
export function transformCalloutTokensInBlock(
    block: OwidEnrichedGdocBlock
): OwidEnrichedGdocBlock {
    traverseEnrichedBlock(block, (node) => {
        if (node.type === "text") {
            node.value = node.value.flatMap(transformCalloutTokensInSpan)
        }
    })
    return block
}
