import { match } from "ts-pattern"
import {
    OwidEnrichedGdocBlock,
    Span,
    EnrichedBlockText,
    EnrichedBlockSimpleText,
    EnrichedBlockPerson,
    BlockSize,
    GdocComments,
} from "@ourworldindata/utils"

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>'
const GDOC_NAMESPACE = "urn:owid:gdoc:v1"

/**
 * Escape text for safe inclusion in XML content.
 */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
}

/**
 * Escape text for safe inclusion in XML attribute values.
 */
function escapeXmlAttr(text: string): string {
    return escapeXml(text).replace(/"/g, "&quot;")
}

/**
 * Build an XML element with optional attributes and content.
 * If content is undefined or empty and the element can self-close, returns a self-closing tag.
 */
function xmlElement(
    tag: string,
    attrs: Record<string, string | number | boolean | undefined> = {},
    content?: string,
    selfClosing = false
): string {
    const attrString = Object.entries(attrs)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => ` ${key}="${escapeXmlAttr(String(value))}"`)
        .join("")

    if (selfClosing && (content === undefined || content === "")) {
        return `<${tag}${attrString}/>`
    }

    return `<${tag}${attrString}>${content ?? ""}</${tag}>`
}

/**
 * Convert a span to XHTML.
 *
 * Span element mapping:
 * - span-simple-text -> text content (escaped)
 * - span-bold -> <b>
 * - span-italic -> <i>
 * - span-underline -> <u>
 * - span-subscript -> <sub>
 * - span-superscript -> <sup>
 * - span-link -> <a href="...">
 * - span-ref -> <ref url="...">
 * - span-dod -> <dod id="...">
 * - span-guided-chart-link -> <glink url="...">
 * - span-quote -> <q>
 * - span-newline -> <br/>
 * - span-fallback -> children only (wrapper stripped)
 */
export function spanToXhtml(span: Span): string {
    return match(span)
        .with({ spanType: "span-simple-text" }, (s) => escapeXml(s.text))
        .with({ spanType: "span-newline" }, () => "<br/>")
        .with({ spanType: "span-bold" }, (s) =>
            xmlElement("b", {}, spansToXhtml(s.children))
        )
        .with({ spanType: "span-italic" }, (s) =>
            xmlElement("i", {}, spansToXhtml(s.children))
        )
        .with({ spanType: "span-underline" }, (s) =>
            xmlElement("u", {}, spansToXhtml(s.children))
        )
        .with({ spanType: "span-subscript" }, (s) =>
            xmlElement("sub", {}, spansToXhtml(s.children))
        )
        .with({ spanType: "span-superscript" }, (s) =>
            xmlElement("sup", {}, spansToXhtml(s.children))
        )
        .with({ spanType: "span-link" }, (s) =>
            xmlElement("a", { href: s.url }, spansToXhtml(s.children))
        )
        .with({ spanType: "span-ref" }, (s) =>
            xmlElement("ref", { url: s.url }, spansToXhtml(s.children))
        )
        .with({ spanType: "span-dod" }, (s) =>
            xmlElement("dod", { id: s.id }, spansToXhtml(s.children))
        )
        .with({ spanType: "span-guided-chart-link" }, (s) =>
            xmlElement("glink", { url: s.url }, spansToXhtml(s.children))
        )
        .with({ spanType: "span-quote" }, (s) =>
            xmlElement("q", {}, spansToXhtml(s.children))
        )
        .with({ spanType: "span-comment-ref" }, (s) =>
            xmlElement(
                "comment-ref",
                { id: s.commentId },
                spansToXhtml(s.children)
            )
        )
        .with({ spanType: "span-fallback" }, (s) => spansToXhtml(s.children))
        .exhaustive()
}

/**
 * Convert an array of spans to XHTML.
 */
export function spansToXhtml(spans: Span[]): string {
    return spans.map(spanToXhtml).join("")
}

/**
 * Convert an optional array of spans to XHTML, returning undefined if empty.
 */
function optionalSpansToXhtml(spans: Span[] | undefined): string | undefined {
    if (!spans || spans.length === 0) return undefined
    return spansToXhtml(spans)
}

/**
 * Helper to conditionally include a property only if it differs from the default.
 */
function sizeIfNotWide(size: BlockSize): string | undefined {
    return size === BlockSize.Wide ? undefined : size
}

/**
 * Convert an enriched text block to XHTML.
 */
function textBlockToXhtml(block: EnrichedBlockText): string {
    return xmlElement("text", {}, spansToXhtml(block.value))
}

/**
 * Convert an enriched simple text block to XHTML.
 */
function simpleTextBlockToXhtml(block: EnrichedBlockSimpleText): string {
    return xmlElement("simple-text", {}, escapeXml(block.value.text))
}

/**
 * Convert a single enriched block to XHTML.
 */
export function enrichedBlockToXhtml(block: OwidEnrichedGdocBlock): string {
    return match(block)
        .with({ type: "text" }, textBlockToXhtml)
        .with({ type: "simple-text" }, simpleTextBlockToXhtml)
        .with({ type: "heading" }, (b) =>
            xmlElement(
                "heading",
                {
                    level: b.level,
                    supertitle: b.supertitle
                        ? spansToXhtml(b.supertitle)
                        : undefined,
                },
                spansToXhtml(b.text)
            )
        )
        .with({ type: "horizontal-rule" }, () =>
            xmlElement("horizontal-rule", {}, "", true)
        )
        .with({ type: "chart" }, (b) => {
            const caption = optionalSpansToXhtml(b.caption)
            return xmlElement(
                "chart",
                {
                    url: b.url,
                    height: b.height,
                    size: sizeIfNotWide(b.size),
                    visibility: b.visibility,
                },
                caption ? xmlElement("caption", {}, caption) : undefined,
                !caption
            )
        })
        .with({ type: "narrative-chart" }, (b) => {
            const caption = optionalSpansToXhtml(b.caption)
            return xmlElement(
                "narrative-chart",
                {
                    name: b.name,
                    height: b.height,
                    size: sizeIfNotWide(b.size),
                },
                caption ? xmlElement("caption", {}, caption) : undefined,
                !caption
            )
        })
        .with({ type: "image" }, (b) => {
            const caption = optionalSpansToXhtml(b.caption)
            return xmlElement(
                "image",
                {
                    filename: b.filename,
                    smallFilename: b.smallFilename,
                    alt: b.alt,
                    size: sizeIfNotWide(b.size),
                    // Always serialize hasOutline - the raw→enriched validation requires it
                    hasOutline: b.hasOutline,
                    visibility: b.visibility,
                },
                caption ? xmlElement("caption", {}, caption) : undefined,
                !caption
            )
        })
        .with({ type: "video" }, (b) => {
            const caption = optionalSpansToXhtml(b.caption)
            return xmlElement(
                "video",
                {
                    url: b.url,
                    filename: b.filename,
                    // Always serialize boolean flags - the raw→enriched validation requires them
                    shouldLoop: b.shouldLoop,
                    shouldAutoplay: b.shouldAutoplay,
                    visibility: b.visibility,
                },
                caption ? xmlElement("caption", {}, caption) : undefined,
                !caption
            )
        })
        .with({ type: "static-viz" }, (b) =>
            xmlElement(
                "static-viz",
                {
                    name: b.name,
                    size: sizeIfNotWide(b.size),
                    // Always serialize hasOutline - the raw→enriched validation requires it
                    hasOutline: b.hasOutline,
                },
                "",
                true
            )
        )
        .with({ type: "list" }, (b) =>
            xmlElement(
                "list",
                {},
                b.items
                    .map((item) =>
                        xmlElement("li", {}, spansToXhtml(item.value))
                    )
                    .join("")
            )
        )
        .with({ type: "numbered-list" }, (b) =>
            xmlElement(
                "numbered-list",
                {},
                b.items
                    .map((item) =>
                        xmlElement("li", {}, spansToXhtml(item.value))
                    )
                    .join("")
            )
        )
        .with({ type: "aside" }, (b) =>
            xmlElement(
                "aside",
                { position: b.position },
                spansToXhtml(b.caption)
            )
        )
        .with({ type: "callout" }, (b) =>
            xmlElement(
                "callout",
                { icon: b.icon, title: b.title },
                enrichedBlocksToXhtml(b.text)
            )
        )
        .with({ type: "blockquote" }, (b) =>
            xmlElement(
                "blockquote",
                { citation: b.citation },
                enrichedBlocksToXhtml(b.text)
            )
        )
        .with({ type: "pull-quote" }, (b) =>
            xmlElement(
                "pull-quote",
                { align: b.align, quote: b.quote },
                enrichedBlocksToXhtml(b.content)
            )
        )
        .with({ type: "code" }, (b) =>
            xmlElement(
                "code",
                {},
                b.text
                    .map((line) =>
                        xmlElement("line", {}, escapeXml(line.value.text))
                    )
                    .join("")
            )
        )
        .with({ type: "html" }, (b) =>
            // Store the HTML in a value attribute to avoid CDATA parsing issues
            xmlElement("html", { value: b.value }, "", true)
        )
        .with({ type: "script" }, (b) =>
            xmlElement(
                "script",
                {},
                b.lines
                    .map((line) => xmlElement("line", {}, escapeXml(line)))
                    .join("")
            )
        )
        .with({ type: "table" }, (b) => {
            const caption = optionalSpansToXhtml(b.caption)
            const rows = b.rows
                .map((row) =>
                    xmlElement(
                        "row",
                        {},
                        row.cells
                            .map((cell) =>
                                xmlElement(
                                    "cell",
                                    {},
                                    enrichedBlocksToXhtml(cell.content)
                                )
                            )
                            .join("")
                    )
                )
                .join("")
            return xmlElement(
                "table",
                {
                    template:
                        b.template !== "header-row" ? b.template : undefined,
                    size: b.size !== "narrow" ? b.size : undefined,
                },
                (caption ? xmlElement("caption", {}, caption) : "") + rows
            )
        })
        .with({ type: "side-by-side" }, (b) =>
            xmlElement(
                "side-by-side",
                {},
                xmlElement("left", {}, enrichedBlocksToXhtml(b.left)) +
                    xmlElement("right", {}, enrichedBlocksToXhtml(b.right))
            )
        )
        .with({ type: "sticky-left" }, (b) =>
            xmlElement(
                "sticky-left",
                {},
                xmlElement("left", {}, enrichedBlocksToXhtml(b.left)) +
                    xmlElement("right", {}, enrichedBlocksToXhtml(b.right))
            )
        )
        .with({ type: "sticky-right" }, (b) =>
            xmlElement(
                "sticky-right",
                {},
                xmlElement("left", {}, enrichedBlocksToXhtml(b.left)) +
                    xmlElement("right", {}, enrichedBlocksToXhtml(b.right))
            )
        )
        .with({ type: "conditional-section" }, (b) =>
            xmlElement(
                "conditional-section",
                {
                    include: b.include.length
                        ? b.include.join(", ")
                        : undefined,
                    exclude: b.exclude.length
                        ? b.exclude.join(", ")
                        : undefined,
                },
                enrichedBlocksToXhtml(b.content)
            )
        )
        .with({ type: "gray-section" }, (b) =>
            xmlElement("gray-section", {}, enrichedBlocksToXhtml(b.items))
        )
        .with({ type: "explore-data-section" }, (b) =>
            xmlElement(
                "explore-data-section",
                {
                    title: b.title,
                    align: b.align !== "left" ? b.align : undefined,
                },
                enrichedBlocksToXhtml(b.content)
            )
        )
        .with({ type: "align" }, (b) =>
            xmlElement(
                "align",
                { alignment: b.alignment },
                enrichedBlocksToXhtml(b.content)
            )
        )
        .with({ type: "expandable-paragraph" }, (b) =>
            xmlElement(
                "expandable-paragraph",
                {},
                enrichedBlocksToXhtml(b.items)
            )
        )
        .with({ type: "expander" }, (b) =>
            xmlElement(
                "expander",
                {
                    title: b.title,
                    // Always include heading for round-trip fidelity
                    heading: b.heading,
                    subtitle: b.subtitle,
                },
                enrichedBlocksToXhtml(b.content)
            )
        )
        .with({ type: "guided-chart" }, (b) =>
            xmlElement("guided-chart", {}, enrichedBlocksToXhtml(b.content))
        )
        .with({ type: "prominent-link" }, (b) =>
            xmlElement(
                "prominent-link",
                {
                    url: b.url,
                    title: b.title,
                    description: b.description,
                    thumbnail: b.thumbnail,
                },
                "",
                true
            )
        )
        .with({ type: "recirc" }, (b) =>
            xmlElement(
                "recirc",
                {
                    title: b.title,
                    align: b.align !== "center" ? b.align : undefined,
                },
                b.links
                    .map((link) =>
                        xmlElement(
                            "link",
                            {
                                url: link.url,
                                title: link.title,
                                subtitle: link.subtitle,
                            },
                            "",
                            true
                        )
                    )
                    .join("")
            )
        )
        .with({ type: "key-insights" }, (b) =>
            xmlElement(
                "key-insights",
                { heading: b.heading },
                b.insights
                    .map((slide) =>
                        xmlElement(
                            "slide",
                            {
                                title: slide.title,
                                url: slide.url,
                                filename: slide.filename,
                                narrativeChartName: slide.narrativeChartName,
                            },
                            enrichedBlocksToXhtml(slide.content)
                        )
                    )
                    .join("")
            )
        )
        .with({ type: "key-indicator" }, (b) =>
            xmlElement(
                "key-indicator",
                {
                    datapageUrl: b.datapageUrl,
                    title: b.title,
                    source: b.source,
                },
                enrichedBlocksToXhtml(b.text)
            )
        )
        .with({ type: "key-indicator-collection" }, (b) =>
            xmlElement(
                "key-indicator-collection",
                {},
                b.blocks.map(enrichedBlockToXhtml).join("")
            )
        )
        .with({ type: "additional-charts" }, (b) =>
            xmlElement(
                "additional-charts",
                {},
                b.items
                    .map((item) => xmlElement("item", {}, spansToXhtml(item)))
                    .join("")
            )
        )
        .with({ type: "all-charts" }, (b) =>
            xmlElement(
                "all-charts",
                { heading: b.heading },
                b.top
                    .map((item) =>
                        xmlElement("top", { url: item.url }, "", true)
                    )
                    .join("")
            )
        )
        .with({ type: "donors" }, () => xmlElement("donors", {}, "", true))
        .with({ type: "sdg-grid" }, (b) =>
            xmlElement(
                "sdg-grid",
                {},
                b.items
                    .map((item) =>
                        xmlElement(
                            "item",
                            { goal: item.goal, link: item.link },
                            "",
                            true
                        )
                    )
                    .join("")
            )
        )
        .with({ type: "sdg-toc" }, () => xmlElement("sdg-toc", {}, "", true))
        .with({ type: "ltp-toc" }, (b) =>
            xmlElement("ltp-toc", { title: b.title }, "", true)
        )
        .with({ type: "missing-data" }, () =>
            xmlElement("missing-data", {}, "", true)
        )
        .with({ type: "chart-story" }, (b) =>
            xmlElement(
                "chart-story",
                {},
                b.items
                    .map((item) =>
                        xmlElement(
                            "item",
                            {},
                            xmlElement(
                                "narrative",
                                {},
                                spansToXhtml(item.narrative.value)
                            ) +
                                enrichedBlockToXhtml(item.chart) +
                                (item.technical.length > 0
                                    ? xmlElement(
                                          "technical",
                                          {},
                                          item.technical
                                              .map((t) =>
                                                  xmlElement(
                                                      "text",
                                                      {},
                                                      spansToXhtml(t.value)
                                                  )
                                              )
                                              .join("")
                                      )
                                    : "")
                        )
                    )
                    .join("")
            )
        )
        .with({ type: "topic-page-intro" }, (b) =>
            xmlElement(
                "topic-page-intro",
                {},
                (b.downloadButton
                    ? xmlElement(
                          "download-button",
                          {
                              text: b.downloadButton.text,
                              url: b.downloadButton.url,
                          },
                          "",
                          true
                      )
                    : "") +
                    (b.relatedTopics && b.relatedTopics.length > 0
                        ? xmlElement(
                              "related-topics",
                              {},
                              b.relatedTopics
                                  .map((topic) =>
                                      xmlElement(
                                          "topic",
                                          { url: topic.url, text: topic.text },
                                          "",
                                          true
                                      )
                                  )
                                  .join("")
                          )
                        : "") +
                    xmlElement("content", {}, enrichedBlocksToXhtml(b.content))
            )
        )
        .with({ type: "research-and-writing" }, (b) =>
            xmlElement(
                "research-and-writing",
                {
                    heading: b.heading,
                    "hide-authors": b["hide-authors"] ? "true" : undefined,
                    "hide-date": b["hide-date"] ? "true" : undefined,
                    variant: b.variant,
                },
                (b.primary.length > 0
                    ? xmlElement(
                          "primary",
                          {},
                          b.primary
                              .map((link) =>
                                  researchAndWritingLinkToXhtml(link)
                              )
                              .join("")
                      )
                    : "") +
                    (b.secondary.length > 0
                        ? xmlElement(
                              "secondary",
                              {},
                              b.secondary
                                  .map((link) =>
                                      researchAndWritingLinkToXhtml(link)
                                  )
                                  .join("")
                          )
                        : "") +
                    b.rows
                        .map((row) =>
                            xmlElement(
                                "row",
                                { heading: row.heading },
                                row.articles
                                    .map((link) =>
                                        researchAndWritingLinkToXhtml(link)
                                    )
                                    .join("")
                            )
                        )
                        .join("") +
                    (b.more
                        ? xmlElement(
                              "more",
                              { heading: b.more.heading },
                              b.more.articles
                                  .map((link) =>
                                      researchAndWritingLinkToXhtml(link)
                                  )
                                  .join("")
                          )
                        : "") +
                    (b.latest
                        ? xmlElement(
                              "latest",
                              { heading: b.latest.heading },
                              "",
                              true
                          )
                        : "")
            )
        )
        .with({ type: "entry-summary" }, (b) =>
            xmlElement(
                "entry-summary",
                {},
                b.items
                    .map((item) =>
                        xmlElement(
                            "item",
                            { text: item.text, slug: item.slug },
                            "",
                            true
                        )
                    )
                    .join("")
            )
        )
        .with({ type: "explorer-tiles" }, (b) =>
            xmlElement(
                "explorer-tiles",
                { title: b.title, subtitle: b.subtitle },
                b.explorers
                    .map((e) =>
                        xmlElement("explorer", { url: e.url }, "", true)
                    )
                    .join("")
            )
        )
        .with({ type: "pill-row" }, (b) =>
            xmlElement(
                "pill-row",
                { title: b.title },
                b.pills
                    .map((pill) =>
                        xmlElement(
                            "pill",
                            { url: pill.url, text: pill.text },
                            "",
                            true
                        )
                    )
                    .join("")
            )
        )
        .with({ type: "homepage-search" }, () =>
            xmlElement("homepage-search", {}, "", true)
        )
        .with({ type: "homepage-intro" }, (b) =>
            xmlElement(
                "homepage-intro",
                {},
                b.featuredWork
                    .map((post) =>
                        xmlElement(
                            "featured-work",
                            {
                                url: post.url,
                                title: post.title,
                                description: post.description,
                                filename: post.filename,
                                kicker: post.kicker,
                                authors: post.authors?.join(", "),
                                // Always include isNew for round-trip fidelity
                                isNew: post.isNew,
                            },
                            "",
                            true
                        )
                    )
                    .join("")
            )
        )
        .with({ type: "featured-metrics" }, () =>
            xmlElement("featured-metrics", {}, "", true)
        )
        .with({ type: "featured-data-insights" }, () =>
            xmlElement("featured-data-insights", {}, "", true)
        )
        .with({ type: "latest-data-insights" }, () =>
            xmlElement("latest-data-insights", {}, "", true)
        )
        .with({ type: "cookie-notice" }, () =>
            xmlElement("cookie-notice", {}, "", true)
        )
        .with({ type: "subscribe-banner" }, (b) =>
            xmlElement(
                "subscribe-banner",
                { align: b.align !== "center" ? b.align : undefined },
                "",
                true
            )
        )
        .with({ type: "cta" }, (b) =>
            xmlElement("cta", { text: b.text, url: b.url }, "", true)
        )
        .with({ type: "socials" }, (b) =>
            xmlElement(
                "socials",
                {},
                b.links
                    .map((link) =>
                        xmlElement(
                            "link",
                            { url: link.url, text: link.text, type: link.type },
                            "",
                            true
                        )
                    )
                    .join("")
            )
        )
        .with({ type: "people" }, (b) =>
            xmlElement("people", {}, b.items.map(personToXhtml).join(""))
        )
        .with({ type: "people-rows" }, (b) =>
            xmlElement(
                "people-rows",
                { columns: b.columns },
                b.people.map(personToXhtml).join("")
            )
        )
        .with({ type: "person" }, personToXhtml)
        .with({ type: "resource-panel" }, (b) =>
            xmlElement(
                "resource-panel",
                {
                    icon: b.icon,
                    kicker: b.kicker,
                    title: b.title,
                    buttonText: b.buttonText,
                },
                b.links
                    .map((link) =>
                        xmlElement(
                            "link",
                            {
                                url: link.url,
                                title: link.title,
                                subtitle: link.subtitle,
                            },
                            "",
                            true
                        )
                    )
                    .join("")
            )
        )
        .exhaustive()
}

/**
 * Helper for research-and-writing link serialization.
 */
function researchAndWritingLinkToXhtml(link: {
    value: {
        url: string
        title?: string
        subtitle?: string
        authors?: string[]
        filename?: string
    }
}): string {
    return xmlElement(
        "link",
        {
            url: link.value.url,
            title: link.value.title,
            subtitle: link.value.subtitle,
            authors: link.value.authors?.join(", "),
            filename: link.value.filename,
        },
        "",
        true
    )
}

/**
 * Helper for person block serialization.
 */
function personToXhtml(b: EnrichedBlockPerson): string {
    return xmlElement(
        "person",
        {
            name: b.name,
            image: b.image,
            title: b.title,
            url: b.url,
        },
        (b.text.length > 0 ? enrichedBlocksToXhtml(b.text) : "") +
            (b.socials && b.socials.length > 0
                ? xmlElement(
                      "socials",
                      {},
                      b.socials
                          .map((s) =>
                              xmlElement(
                                  "social",
                                  { url: s.url, text: s.text, type: s.type },
                                  "",
                                  true
                              )
                          )
                          .join("")
                  )
                : "")
    )
}

/**
 * Convert an array of enriched blocks to XHTML.
 */
export function enrichedBlocksToXhtml(blocks: OwidEnrichedGdocBlock[]): string {
    return blocks.map(enrichedBlockToXhtml).join("")
}

/**
 * Pretty-print XHTML with proper indentation.
 * Self-closing tags and inline content stay on one line.
 */
export function prettyPrintXhtml(xhtml: string, indentSize = 2): string {
    const lines: string[] = []
    let depth = 0
    const indent = (): string => " ".repeat(depth * indentSize)

    // Split into tokens: tags and text content
    const tokens = xhtml.split(/(<[^>]+>)/g).filter((t) => t.length > 0)

    for (const token of tokens) {
        if (!token.startsWith("<")) {
            // Text content - always append to last line (inline with opening tag)
            const trimmed = token.trim()
            if (trimmed && lines.length > 0) {
                lines[lines.length - 1] += token
            }
            continue
        }

        const isClosingTag = token.startsWith("</")
        const isSelfClosing = token.endsWith("/>")
        const isXmlDeclaration = token.startsWith("<?")

        if (isXmlDeclaration) {
            lines.push(token)
        } else if (isClosingTag) {
            depth = Math.max(0, depth - 1)
            // Check if the last line contains the opening tag or content for this element
            const lastLine = lines[lines.length - 1] || ""
            const tagName = token.match(/<\/([a-z-]+)>/i)?.[1]
            if (
                tagName &&
                lastLine.includes(`<${tagName}`) &&
                !lastLine.includes(`</${tagName}>`)
            ) {
                // Inline the closing tag with the opening tag/content
                lines[lines.length - 1] += token
            } else {
                lines.push(indent() + token)
            }
        } else if (isSelfClosing) {
            lines.push(indent() + token)
        } else {
            // Opening tag
            lines.push(indent() + token)
            depth++
        }
    }

    return lines.join("\n")
}

/**
 * Convert a single comment thread to XHTML.
 *
 * Format:
 * <comment id="c1" author="email" time="..." resolved="false">
 *   <content>Comment text</content>
 *   <reply id="r1" author="..." time="...">Reply text</reply>
 * </comment>
 */
function commentThreadToXhtml(thread: {
    id: string
    author: string
    content: string
    createdTime: string
    resolved: boolean
    replies: Array<{
        id: string
        author: string
        content: string
        createdTime: string
    }>
}): string {
    const replies = thread.replies
        .map((reply) =>
            xmlElement(
                "reply",
                {
                    id: reply.id,
                    author: reply.author,
                    time: reply.createdTime,
                },
                escapeXml(reply.content)
            )
        )
        .join("")

    return xmlElement(
        "comment",
        {
            id: thread.id,
            author: thread.author,
            time: thread.createdTime,
            resolved: thread.resolved,
        },
        xmlElement("content", {}, escapeXml(thread.content)) + replies
    )
}

/**
 * Convert comments to XHTML block.
 *
 * Format:
 * <comments>
 *   <comment id="c1" ...>...</comment>
 *   <comment id="c2" ...>...</comment>
 * </comments>
 */
export function commentsToXhtml(comments: GdocComments): string {
    if (!comments.threads.length) return ""

    const threads = comments.threads.map(commentThreadToXhtml).join("")
    return xmlElement("comments", {}, threads)
}

/**
 * Convert an array of enriched blocks to a complete XHTML document.
 * Output is pretty-printed with proper indentation.
 * Optionally includes comments at the end of the document.
 */
export function enrichedBlocksToXhtmlDocument(
    blocks: OwidEnrichedGdocBlock[],
    comments?: GdocComments | null
): string {
    const blocksXhtml = enrichedBlocksToXhtml(blocks)
    const commentsXhtml = comments ? commentsToXhtml(comments) : ""
    const raw = `${XML_DECLARATION}<gdoc xmlns="${GDOC_NAMESPACE}">${blocksXhtml}${commentsXhtml}</gdoc>`
    return prettyPrintXhtml(raw)
}
