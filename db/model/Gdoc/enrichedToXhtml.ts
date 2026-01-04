import { match } from "ts-pattern"
import {
    OwidEnrichedGdocBlock,
    Span,
    EnrichedBlockText,
    EnrichedBlockSimpleText,
    EnrichedBlockPerson,
    BlockSize,
    GdocComments,
    CommentThread,
} from "@ourworldindata/utils"

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>'
const GDOC_NAMESPACE = "urn:owid:gdoc:v1"

/**
 * Collect all comment IDs referenced in an array of spans.
 */
function collectCommentIdsFromSpans(spans: Span[]): Set<string> {
    const ids = new Set<string>()
    for (const span of spans) {
        if (span.spanType === "span-comment-ref") {
            ids.add(span.commentId)
        }
        if ("children" in span && span.children) {
            for (const id of collectCommentIdsFromSpans(span.children)) {
                ids.add(id)
            }
        }
    }
    return ids
}

/**
 * Collect all comment IDs referenced in a block (recursively).
 */
function collectCommentIdsFromBlock(block: OwidEnrichedGdocBlock): Set<string> {
    const ids = new Set<string>()

    const addSpans = (spans: Span[] | undefined): void => {
        if (spans) {
            for (const id of collectCommentIdsFromSpans(spans)) {
                ids.add(id)
            }
        }
    }

    const addBlocks = (blocks: OwidEnrichedGdocBlock[] | undefined): void => {
        if (blocks) {
            for (const b of blocks) {
                for (const id of collectCommentIdsFromBlock(b)) {
                    ids.add(id)
                }
            }
        }
    }

    match(block)
        .with({ type: "text" }, (b) => addSpans(b.value))
        .with({ type: "simple-text" }, () => {})
        .with({ type: "heading" }, (b) => {
            addSpans(b.text)
            addSpans(b.supertitle)
        })
        .with({ type: "horizontal-rule" }, () => {})
        .with({ type: "chart" }, (b) => addSpans(b.caption))
        .with({ type: "narrative-chart" }, (b) => addSpans(b.caption))
        .with({ type: "image" }, (b) => addSpans(b.caption))
        .with({ type: "video" }, (b) => addSpans(b.caption))
        .with({ type: "static-viz" }, () => {})
        .with({ type: "list" }, (b) =>
            b.items.forEach((i) => addSpans(i.value))
        )
        .with({ type: "numbered-list" }, (b) =>
            b.items.forEach((i) => addSpans(i.value))
        )
        .with({ type: "aside" }, (b) => addSpans(b.caption))
        .with({ type: "callout" }, (b) => addBlocks(b.text))
        .with({ type: "blockquote" }, (b) => addBlocks(b.text))
        .with({ type: "pull-quote" }, (b) => addBlocks(b.content))
        .with({ type: "code" }, () => {})
        .with({ type: "html" }, () => {})
        .with({ type: "script" }, () => {})
        .with({ type: "table" }, (b) => {
            addSpans(b.caption)
            b.rows.forEach((row) =>
                row.cells.forEach((cell) => addBlocks(cell.content))
            )
        })
        .with({ type: "side-by-side" }, (b) => {
            addBlocks(b.left)
            addBlocks(b.right)
        })
        .with({ type: "sticky-left" }, (b) => {
            addBlocks(b.left)
            addBlocks(b.right)
        })
        .with({ type: "sticky-right" }, (b) => {
            addBlocks(b.left)
            addBlocks(b.right)
        })
        .with({ type: "conditional-section" }, (b) => addBlocks(b.content))
        .with({ type: "gray-section" }, (b) => addBlocks(b.items))
        .with({ type: "explore-data-section" }, (b) => addBlocks(b.content))
        .with({ type: "align" }, (b) => addBlocks(b.content))
        .with({ type: "expandable-paragraph" }, (b) => addBlocks(b.items))
        .with({ type: "expander" }, (b) => addBlocks(b.content))
        .with({ type: "guided-chart" }, (b) => addBlocks(b.content))
        .with({ type: "prominent-link" }, () => {})
        .with({ type: "recirc" }, () => {})
        .with({ type: "key-insights" }, (b) =>
            b.insights.forEach((slide) => addBlocks(slide.content))
        )
        .with({ type: "key-indicator" }, (b) => addBlocks(b.text))
        .with({ type: "key-indicator-collection" }, (b) => addBlocks(b.blocks))
        .with({ type: "additional-charts" }, (b) =>
            b.items.forEach((item) => addSpans(item))
        )
        .with({ type: "all-charts" }, () => {})
        .with({ type: "donors" }, () => {})
        .with({ type: "sdg-grid" }, () => {})
        .with({ type: "sdg-toc" }, () => {})
        .with({ type: "ltp-toc" }, () => {})
        .with({ type: "missing-data" }, () => {})
        .with({ type: "chart-story" }, (b) =>
            b.items.forEach((item) => {
                addSpans(item.narrative.value)
                for (const id of collectCommentIdsFromBlock(item.chart)) {
                    ids.add(id)
                }
                item.technical.forEach((t) => addSpans(t.value))
            })
        )
        .with({ type: "topic-page-intro" }, (b) => addBlocks(b.content))
        .with({ type: "research-and-writing" }, () => {})
        .with({ type: "entry-summary" }, () => {})
        .with({ type: "explorer-tiles" }, () => {})
        .with({ type: "pill-row" }, () => {})
        .with({ type: "homepage-search" }, () => {})
        .with({ type: "homepage-intro" }, () => {})
        .with({ type: "featured-metrics" }, () => {})
        .with({ type: "featured-data-insights" }, () => {})
        .with({ type: "latest-data-insights" }, () => {})
        .with({ type: "cookie-notice" }, () => {})
        .with({ type: "subscribe-banner" }, () => {})
        .with({ type: "cta" }, () => {})
        .with({ type: "socials" }, () => {})
        .with({ type: "people" }, (b) =>
            b.items.forEach((p) => addBlocks(p.text))
        )
        .with({ type: "people-rows" }, (b) =>
            b.people.forEach((p) => addBlocks(p.text))
        )
        .with({ type: "person" }, (b) => addBlocks(b.text))
        .with({ type: "resource-panel" }, () => {})
        .exhaustive()

    return ids
}

/**
 * Options for XHTML serialization.
 */
export interface XhtmlSerializationOptions {
    /**
     * Whether to include comments in the output.
     * When false:
     * - <comments> blocks are omitted
     * - <comment-ref> elements transparently output their children
     * Default: true
     */
    includeComments?: boolean
}

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
 * - span-comment-ref -> <comment-ref id="..."> or children only if comments disabled
 */
export function spanToXhtml(
    span: Span,
    options: XhtmlSerializationOptions = {}
): string {
    const { includeComments = true } = options
    const toXhtml = (spans: Span[]): string => spansToXhtml(spans, options)

    return match(span)
        .with({ spanType: "span-simple-text" }, (s) => escapeXml(s.text))
        .with({ spanType: "span-newline" }, () => "<br/>")
        .with({ spanType: "span-bold" }, (s) =>
            xmlElement("b", {}, toXhtml(s.children))
        )
        .with({ spanType: "span-italic" }, (s) =>
            xmlElement("i", {}, toXhtml(s.children))
        )
        .with({ spanType: "span-underline" }, (s) =>
            xmlElement("u", {}, toXhtml(s.children))
        )
        .with({ spanType: "span-subscript" }, (s) =>
            xmlElement("sub", {}, toXhtml(s.children))
        )
        .with({ spanType: "span-superscript" }, (s) =>
            xmlElement("sup", {}, toXhtml(s.children))
        )
        .with({ spanType: "span-link" }, (s) =>
            xmlElement("a", { href: s.url }, toXhtml(s.children))
        )
        .with({ spanType: "span-ref" }, (s) =>
            xmlElement("ref", { url: s.url }, toXhtml(s.children))
        )
        .with({ spanType: "span-dod" }, (s) =>
            xmlElement("dod", { id: s.id }, toXhtml(s.children))
        )
        .with({ spanType: "span-guided-chart-link" }, (s) =>
            xmlElement("glink", { url: s.url }, toXhtml(s.children))
        )
        .with({ spanType: "span-quote" }, (s) =>
            xmlElement("q", {}, toXhtml(s.children))
        )
        .with({ spanType: "span-comment-ref" }, (s) =>
            // When comments are disabled, just output children (like span-fallback)
            includeComments
                ? xmlElement(
                      "comment-ref",
                      { id: s.commentId },
                      toXhtml(s.children)
                  )
                : toXhtml(s.children)
        )
        .with({ spanType: "span-fallback" }, (s) => toXhtml(s.children))
        .exhaustive()
}

/**
 * Convert an array of spans to XHTML.
 */
export function spansToXhtml(
    spans: Span[],
    options: XhtmlSerializationOptions = {}
): string {
    return spans.map((s) => spanToXhtml(s, options)).join("")
}

/**
 * Convert an optional array of spans to XHTML, returning undefined if empty.
 */
function optionalSpansToXhtml(
    spans: Span[] | undefined,
    options: XhtmlSerializationOptions = {}
): string | undefined {
    if (!spans || spans.length === 0) return undefined
    return spansToXhtml(spans, options)
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
function textBlockToXhtml(
    block: EnrichedBlockText,
    options: XhtmlSerializationOptions = {}
): string {
    return xmlElement("text", {}, spansToXhtml(block.value, options))
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
export function enrichedBlockToXhtml(
    block: OwidEnrichedGdocBlock,
    options: XhtmlSerializationOptions = {}
): string {
    const toSpansXhtml = (spans: Span[]): string => spansToXhtml(spans, options)
    const toBlocksXhtml = (blocks: OwidEnrichedGdocBlock[]): string =>
        enrichedBlocksToXhtml(blocks, options)
    const optSpansToXhtml = (spans: Span[] | undefined): string | undefined =>
        optionalSpansToXhtml(spans, options)

    return match(block)
        .with({ type: "text" }, (b) => textBlockToXhtml(b, options))
        .with({ type: "simple-text" }, simpleTextBlockToXhtml)
        .with({ type: "heading" }, (b) =>
            xmlElement(
                "heading",
                {
                    level: b.level,
                    supertitle: b.supertitle
                        ? toSpansXhtml(b.supertitle)
                        : undefined,
                },
                toSpansXhtml(b.text)
            )
        )
        .with({ type: "horizontal-rule" }, () =>
            xmlElement("horizontal-rule", {}, "", true)
        )
        .with({ type: "chart" }, (b) => {
            const caption = optSpansToXhtml(b.caption)
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
            const caption = optSpansToXhtml(b.caption)
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
            const caption = optSpansToXhtml(b.caption)
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
            const caption = optSpansToXhtml(b.caption)
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
                        xmlElement("li", {}, toSpansXhtml(item.value))
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
                        xmlElement("li", {}, toSpansXhtml(item.value))
                    )
                    .join("")
            )
        )
        .with({ type: "aside" }, (b) =>
            xmlElement(
                "aside",
                { position: b.position },
                toSpansXhtml(b.caption)
            )
        )
        .with({ type: "callout" }, (b) =>
            xmlElement(
                "callout",
                { icon: b.icon, title: b.title },
                toBlocksXhtml(b.text)
            )
        )
        .with({ type: "blockquote" }, (b) =>
            xmlElement(
                "blockquote",
                { citation: b.citation },
                toBlocksXhtml(b.text)
            )
        )
        .with({ type: "pull-quote" }, (b) =>
            xmlElement(
                "pull-quote",
                { align: b.align, quote: b.quote },
                toBlocksXhtml(b.content)
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
            const caption = optSpansToXhtml(b.caption)
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
                                    toBlocksXhtml(cell.content)
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
                xmlElement("left", {}, toBlocksXhtml(b.left)) +
                    xmlElement("right", {}, toBlocksXhtml(b.right))
            )
        )
        .with({ type: "sticky-left" }, (b) =>
            xmlElement(
                "sticky-left",
                {},
                xmlElement("left", {}, toBlocksXhtml(b.left)) +
                    xmlElement("right", {}, toBlocksXhtml(b.right))
            )
        )
        .with({ type: "sticky-right" }, (b) =>
            xmlElement(
                "sticky-right",
                {},
                xmlElement("left", {}, toBlocksXhtml(b.left)) +
                    xmlElement("right", {}, toBlocksXhtml(b.right))
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
            xmlElement("gray-section", {}, toBlocksXhtml(b.items))
        )
        .with({ type: "explore-data-section" }, (b) =>
            xmlElement(
                "explore-data-section",
                {
                    title: b.title,
                    align: b.align !== "left" ? b.align : undefined,
                },
                toBlocksXhtml(b.content)
            )
        )
        .with({ type: "align" }, (b) =>
            xmlElement(
                "align",
                { alignment: b.alignment },
                toBlocksXhtml(b.content)
            )
        )
        .with({ type: "expandable-paragraph" }, (b) =>
            xmlElement("expandable-paragraph", {}, toBlocksXhtml(b.items))
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
                toBlocksXhtml(b.content)
            )
        )
        .with({ type: "guided-chart" }, (b) =>
            xmlElement("guided-chart", {}, toBlocksXhtml(b.content))
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
                            toBlocksXhtml(slide.content)
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
                toBlocksXhtml(b.text)
            )
        )
        .with({ type: "key-indicator-collection" }, (b) =>
            xmlElement(
                "key-indicator-collection",
                {},
                b.blocks
                    .map((block) => enrichedBlockToXhtml(block, options))
                    .join("")
            )
        )
        .with({ type: "additional-charts" }, (b) =>
            xmlElement(
                "additional-charts",
                {},
                b.items
                    .map((item) => xmlElement("item", {}, toSpansXhtml(item)))
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
                                toSpansXhtml(item.narrative.value)
                            ) +
                                enrichedBlockToXhtml(item.chart, options) +
                                (item.technical.length > 0
                                    ? xmlElement(
                                          "technical",
                                          {},
                                          item.technical
                                              .map((t) =>
                                                  xmlElement(
                                                      "text",
                                                      {},
                                                      toSpansXhtml(t.value)
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
                    xmlElement("content", {}, toBlocksXhtml(b.content))
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
            xmlElement(
                "people",
                {},
                b.items.map((p) => personToXhtml(p, options)).join("")
            )
        )
        .with({ type: "people-rows" }, (b) =>
            xmlElement(
                "people-rows",
                { columns: b.columns },
                b.people.map((p) => personToXhtml(p, options)).join("")
            )
        )
        .with({ type: "person" }, (b) => personToXhtml(b, options))
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
function personToXhtml(
    b: EnrichedBlockPerson,
    options: XhtmlSerializationOptions = {}
): string {
    return xmlElement(
        "person",
        {
            name: b.name,
            image: b.image,
            title: b.title,
            url: b.url,
        },
        (b.text.length > 0 ? enrichedBlocksToXhtml(b.text, options) : "") +
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
export function enrichedBlocksToXhtml(
    blocks: OwidEnrichedGdocBlock[],
    options: XhtmlSerializationOptions = {}
): string {
    return blocks.map((b) => enrichedBlockToXhtml(b, options)).join("")
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
function commentThreadToXhtml(thread: CommentThread): string {
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
 * When comments are included, each comment is placed immediately after
 * the top-level block that contains its reference.
 *
 * @param blocks - The enriched blocks to convert
 * @param comments - Optional comments to interleave after blocks
 * @param options - Serialization options (includeComments defaults to true)
 */
export function enrichedBlocksToXhtmlDocument(
    blocks: OwidEnrichedGdocBlock[],
    comments?: GdocComments | null,
    options: XhtmlSerializationOptions = {}
): string {
    const { includeComments = true } = options

    let blocksXhtml: string
    if (includeComments && comments && comments.threads.length > 0) {
        // Build a map from comment ID to thread for quick lookup
        const threadById = new Map<string, CommentThread>()
        for (const thread of comments.threads) {
            threadById.set(thread.id, thread)
        }

        // Track which comment IDs have been output to avoid duplicates
        const outputCommentIds = new Set<string>()

        // Serialize each block followed by its referenced comments
        const parts: string[] = []
        for (const block of blocks) {
            parts.push(enrichedBlockToXhtml(block, options))

            // Find all comment IDs referenced in this block
            const referencedIds = collectCommentIdsFromBlock(block)
            for (const id of referencedIds) {
                if (!outputCommentIds.has(id)) {
                    const thread = threadById.get(id)
                    if (thread) {
                        parts.push(commentThreadToXhtml(thread))
                        outputCommentIds.add(id)
                    }
                }
            }
        }
        blocksXhtml = parts.join("")
    } else {
        blocksXhtml = enrichedBlocksToXhtml(blocks, options)
    }

    const raw = `${XML_DECLARATION}<gdoc xmlns="${GDOC_NAMESPACE}">${blocksXhtml}</gdoc>`
    return prettyPrintXhtml(raw)
}
