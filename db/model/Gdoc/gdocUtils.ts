import { Span } from "@ourworldindata/utils"
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
    if (html.trim().startsWith("http")) return html.trim()
    const $ = cheerio.load(html)
    return $("a").attr("href")
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
