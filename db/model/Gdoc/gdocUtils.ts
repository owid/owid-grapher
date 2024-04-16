import {
    EnrichedBlockResearchAndWriting,
    Span,
    excludeNullish,
    EnrichedBlockResearchAndWritingLink,
    DATA_INSIGHTS_INDEX_PAGE_SIZE,
    OwidEnrichedGdocBlock,
    noop,
} from "@ourworldindata/utils"
import { match, P } from "ts-pattern"
import cheerio from "cheerio"

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
                    "span-italic",
                    "span-bold",
                    "span-underline",
                    "span-subscript",
                    "span-superscript",
                    "span-quote",
                    "span-fallback"
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
                    "entry-summary",
                    "expandable-paragraph",
                    "explorer-tiles",
                    "gray-section",
                    "heading",
                    "homepage-search",
                    "horizontal-rule",
                    "html",
                    "key-indicator-collection",
                    "key-indicator",
                    "latest-data-insights",
                    "list",
                    "missing-data",
                    "numbered-list",
                    "pill-row",
                    "pull-quote",
                    "recirc",
                    "scroller",
                    "sdg-grid",
                    "sdg-toc",
                    "side-by-side",
                    "simple-text",
                    "socials",
                    "sticky-left",
                    "sticky-right",
                    "table",
                    "text",
                    "topic-page-intro"
                ),
            },
            noop
        )
        .exhaustive()
    return [...filenames]
}
