import * as _ from "lodash-es"
import {
    EnrichedBlockKeyIndicator,
    gdocUrlRegex,
    RESEARCH_AND_WRITING_DEFAULT_HEADING,
} from "@ourworldindata/types"
import { getLinkType } from "@ourworldindata/components"
import {
    OwidEnrichedGdocBlock,
    Span,
    excludeNullish,
} from "@ourworldindata/utils"
import { match, P } from "ts-pattern"

export function spanToMarkdown(s: Span): string {
    return match(s)
        .with({ spanType: "span-simple-text" }, (span) => span.text)
        .with({ spanType: "span-newline" }, () => "\n  ")
        .with({ spanType: "span-link" }, (link) => {
            if (link.url.match(gdocUrlRegex)) {
                return spansToMarkdown(link.children)
            }
            return `[${spansToMarkdown(link.children)}](${link.url})`
        })
        .with(
            { spanType: "span-italic" },
            (span) => `_${spansToMarkdown(span.children)}_`
        )
        .with(
            { spanType: "span-bold" },
            (span) => `**${spansToMarkdown(span.children)}**`
        )
        .with(
            { spanType: "span-dod" },
            (span) => `[${spansToMarkdown(span.children)}](#dod:${span.id})`
        )
        .with(
            {
                spanType: P.union(
                    "span-ref",
                    "span-underline",
                    "span-subscript",
                    "span-superscript",
                    "span-quote",
                    "span-fallback"
                ),
            },
            (other) => spansToMarkdown(other.children)
        )
        .exhaustive()
}

export function spansToMarkdown(spans: Span[] | undefined): string {
    return spans?.map((span) => spanToMarkdown(span)).join("") ?? ""
}

const CUSTOM_MARKDOWN_COMPONENTS = {
    AllCharts: "AllCharts",
    Callout: "Callout",
    Chart: "Chart",
    DonorList: "DonorList",
    Image: "Image",
    KeyIndicator: "KeyIndicator",
    NarrativeChart: "NarrativeChart",
    Video: "Video",
}

function markdownComponent(
    componentName: keyof typeof CUSTOM_MARKDOWN_COMPONENTS,
    attributes: Record<string, string | undefined>,
    exportComponents: boolean
): string | undefined {
    const attributesString = Object.entries(attributes)
        .filter(([_, val]) => val !== undefined)
        .map(([key, val]) => `${key}="${val}"`)
        .join(" ")
    if (exportComponents) return `<${componentName} ${attributesString}/>`
    else return undefined
}

/**
 * Strips out <Image />, <Video />, etc. components.
 * Helpful if trying to get a plaintext version of the content because mdast-util-from-markdown
 * doesn't support these components.
 */
export function stripCustomMarkdownComponents(content: string): string {
    let strippedContent = content
    for (const componentName of Object.values(CUSTOM_MARKDOWN_COMPONENTS)) {
        const regex = new RegExp(`<${componentName}[^\n]*?/>`, "g")
        strippedContent = strippedContent.replace(regex, "")
    }
    return strippedContent
}

export function enrichedBlocksToMarkdown(
    blocks: OwidEnrichedGdocBlock[] | undefined,
    exportComponents: boolean
): string | undefined {
    if (!blocks) return undefined
    const result = excludeNullish(
        blocks.map((block) => enrichedBlockToMarkdown(block, exportComponents))
    ).join("\n\n")
    if (result === "") return undefined
    else return result
}

export function enrichedBlockToMarkdown(
    block: OwidEnrichedGdocBlock,
    exportComponents: boolean
): string | undefined {
    if (!block.type) return undefined
    return match(block)
        .with({ type: "text" }, (b): string | undefined => {
            // TODO: the cases below should not happen but come up in the DB - this is a debug helper to get to the bottom of it
            if (b.value === undefined)
                console.error("Text block value is undefined")
            if (!_.isArray(b.value))
                console.error("Text block value is not an array", b.value)
            return spansToMarkdown(b.value)
        })
        .with({ type: "simple-text" }, (b): string | undefined => b.value.text)
        .with({ type: "all-charts" }, (b): string | undefined =>
            markdownComponent(
                "AllCharts",
                { heading: b.heading }, // Note: truncated
                exportComponents
            )
        )
        .with({ type: "additional-charts" }, (b): string | undefined => {
            if (!exportComponents) return undefined
            else {
                const items = b.items
                    .map((i) => `* ${spansToMarkdown(i)}`)
                    .join("\n")
                return `<AdditionalCharts>
${items}
</AdditionalCharts>`
            }
        })
        .with({ type: "callout" }, (b): string | undefined =>
            markdownComponent(
                "Callout",
                {
                    title: b.title, // Note: truncated
                },
                exportComponents
            )
        )
        .with({ type: "chart" }, (b): string | undefined =>
            markdownComponent(
                "Chart",
                {
                    url: b.url,
                    caption: b.caption ? spansToMarkdown(b.caption) : undefined,
                    // Note: truncated
                },
                exportComponents
            )
        )
        .with({ type: "narrative-chart" }, (b): string | undefined =>
            markdownComponent(
                "NarrativeChart",
                {
                    name: b.name,
                    caption: b.caption ? spansToMarkdown(b.caption) : undefined,
                    // Note: truncated
                },
                exportComponents
            )
        )
        .with({ type: "code" }, (b): string | undefined => {
            return (
                "```\n" +
                b.text.map((text) => text.value.text).join("\n") +
                "\n```"
            )
        })
        .with({ type: "cookie-notice" }, () => undefined)
        .with({ type: "donors" }, (_): string | undefined =>
            markdownComponent("DonorList", {}, exportComponents)
        )
        .with({ type: "scroller" }, () => undefined) // Note: dropped
        .with(
            { type: "chart-story" },
            () => undefined // Note: dropped
        )
        .with({ type: "image" }, (b): string | undefined =>
            markdownComponent(
                "Image",
                {
                    filename: b.filename,
                    alt: b.alt,
                },
                exportComponents
            )
        )
        .with({ type: "video" }, (b): string | undefined =>
            markdownComponent(
                "Video",
                {
                    url: b.url,
                    filename: b.filename,
                    caption: b.caption ? spansToMarkdown(b.caption) : undefined,
                    shouldLoop: String(b.shouldLoop),
                },
                exportComponents
            )
        )
        .with({ type: "list" }, (b): string | undefined =>
            b.items.map((item) => `* ${spansToMarkdown(item.value)}`).join("\n")
        )
        .with({ type: "people" }, (b): string | undefined =>
            b.items
                .map((item) => enrichedBlockToMarkdown(item, exportComponents))
                .join("\n")
        )
        .with({ type: "people-rows" }, (b): string | undefined =>
            b.people
                .map((item) => enrichedBlockToMarkdown(item, exportComponents))
                .join("\n")
        )
        .with({ type: "person" }, (b): string | undefined => {
            const items = [
                b.image &&
                    markdownComponent(
                        "Image",
                        { filename: b.image, alt: b.name },
                        exportComponents
                    ),
                `### ${b.name}`,
                b.title,
                enrichedBlocksToMarkdown(b.text, exportComponents),
            ]
            return _.compact(items).join("\n")
        })
        .with({ type: "pull-quote" }, (b): string | undefined => {
            const quote = b.quote
            const content = b.content
                .map((block) =>
                    enrichedBlockToMarkdown(block, exportComponents)
                )
                .join("\n")

            return `> ${quote}\n\n${content}`
        })
        .with({ type: "recirc" }, (b): string | undefined => {
            const items = b.links.map((i) => `* ${i.url}`).join("\n")
            return `### ${b.title}
${items}`
        })
        .with({ type: "html" }, (b): string | undefined =>
            exportComponents ? b.value : undefined
        )
        .with({ type: "heading" }, (b): string | undefined => {
            const prefix = "#".repeat(b.level)
            const text = b.supertitle
                ? [
                      spansToMarkdown(b.supertitle),
                      "\u000b",
                      spansToMarkdown(b.text),
                  ].join("")
                : spansToMarkdown(b.text)
            return `${prefix} ${text}`
        })
        .with({ type: "horizontal-rule" }, () => "---")
        .with({ type: "sdg-grid" }, (b): string | undefined =>
            b.items.map((item) => `${item.goal}: ${item.link}`).join("\n")
        )
        .with(
            { type: P.union("side-by-side", "sticky-left", "sticky-right") },
            (b): string | undefined => {
                const nonNullishLeft = excludeNullish(
                    b.left.map((item) =>
                        enrichedBlockToMarkdown(item, exportComponents)
                    )
                )
                const nonNullishRight = excludeNullish(
                    b.right.map((item) =>
                        enrichedBlockToMarkdown(item, exportComponents)
                    )
                )

                return `${nonNullishLeft.join("\n")}\n${nonNullishRight.join("\n")}`
            }
        )
        .with({ type: "gray-section" }, (b): string | undefined =>
            enrichedBlocksToMarkdown(b.items, exportComponents)
        )
        .with({ type: "prominent-link" }, (b): string | undefined => {
            if (b.url.match(gdocUrlRegex)) {
                return undefined
            }
            let text = ""
            if (b.title) {
                text += `### ${b.title}\n`
            }
            if (b.description) {
                text += `${b.description}}\n`
            }
            if (b.url) {
                text += `${b.url}\n`
            }
            return text
        })
        .with({ type: "sdg-toc" }, () => undefined)
        .with({ type: "missing-data" }, () => undefined)
        .with({ type: "numbered-list" }, (b): string | undefined =>
            b.items
                .map((item, i) => `${i}. ${spansToMarkdown(item.value)}`)
                .join("\n")
        )
        .with({ type: "aside" }, (b): string | undefined =>
            spansToMarkdown(b.caption)
        )
        .with({ type: "expandable-paragraph" }, (b): string | undefined =>
            enrichedBlocksToMarkdown(b.items, exportComponents)
        )
        .with(
            { type: "expander" },
            (b): string | undefined =>
                `${b.title}\n${enrichedBlocksToMarkdown(b.content, exportComponents)}`
        )
        .with({ type: "topic-page-intro" }, (b): string | undefined =>
            enrichedBlocksToMarkdown(b.content, exportComponents)
        )
        .with({ type: "latest-data-insights" }, (): undefined => undefined) // Note: dropped
        .with({ type: "key-insights" }, (b): string | undefined => {
            // TODO: handle either filename or url as a chart or image
            const insightTexts = b.insights.map((insight) => {
                const imageOrChart = insight.filename
                    ? `![](${insight.filename})`
                    : insight.url
                      ? markdownComponent(
                            "Chart",
                            { url: insight.url },
                            exportComponents
                        )
                      : insight.narrativeChartName
                        ? markdownComponent(
                              "NarrativeChart",
                              { name: insight.narrativeChartName },
                              exportComponents
                          )
                        : undefined
                const content =
                    enrichedBlocksToMarkdown(
                        insight.content,
                        exportComponents
                    ) ?? ""

                const text = `### ${insight.title}
${content}
${imageOrChart}`
                return text
            })
            const allInsights = insightTexts.join("\n\n")
            return `## ${b.heading}
${allInsights}`
        })
        .with({ type: "research-and-writing" }, (b): string | undefined => {
            const links = [
                ...b.primary.map((item) => item.value.url),
                ...b.secondary.map((item) => item.value.url),
                ...b.rows.flatMap((item) =>
                    item.articles.map((i) => i.value.url)
                ),
                ...(b.more?.articles ?? []).map((item) => item.value.url),
            ]
                .filter((link) => !link.match(gdocUrlRegex))
                .map((link) => `* ${link}\n`)
            return `## ${b.heading || RESEARCH_AND_WRITING_DEFAULT_HEADING}
${links}`
        })
        .with({ type: "align" }, (b): string | undefined =>
            enrichedBlocksToMarkdown(b.content, exportComponents)
        )
        .with({ type: "entry-summary" }, () => undefined) // Note: dropped
        .with({ type: "table" }, (b): string | undefined => {
            const rows = b.rows.map((row) => {
                const cells = row.cells.map((cell) =>
                    enrichedBlocksToMarkdown(cell.content, exportComponents)
                )
                return `|${cells.join("|")}|`
            })
            return "\n" + rows.join("\n") // markdown tables need a leading empty line
        })
        .with({ type: "explorer-tiles" }, () => undefined) // Note: dropped
        .with({ type: "blockquote" }, (b): string | undefined => {
            const text = excludeNullish(
                b.text.map((text) =>
                    enrichedBlockToMarkdown(text, exportComponents)
                )
            ).join("\n\n> ")
            return `> ${text}` + b.citation ? `\n-- ${b.citation}` : ""
        })
        .with({ type: "key-indicator" }, (b): string | undefined =>
            markdownComponent(
                "KeyIndicator",
                {
                    datapageUrl: b.datapageUrl,
                    title: b.title,
                    source: b.source,
                    // text ignored
                },
                exportComponents
            )
        )
        .with({ type: "key-indicator-collection" }, (b): string | undefined => {
            const keyIndicators = b.blocks
                .map((keyIndicatorBlock: EnrichedBlockKeyIndicator) =>
                    enrichedBlockToMarkdown(keyIndicatorBlock, exportComponents)
                )
                .join("\n")
            return `<KeyIndicatorCollection>\n${keyIndicators}\n</KeyIndicatorCollection>`
        })
        .with({ type: "pill-row" }, (b): string | undefined => {
            const title = b.title ? `### ${b.title}` : ""
            const pills = b.pills
                .filter((pill) => !pill.url.match(gdocUrlRegex))
                .map((pill) => `* [${pill.text}](${pill.url})`)
                .join("\n")
            return [title, pills].join("\n")
        })
        .with({ type: "homepage-search" }, (_): string | undefined => {
            return ""
        })
        .with({ type: "homepage-intro" }, (b): string | undefined => {
            return b.featuredWork
                .map((item) =>
                    getLinkType(item.url) === "gdoc"
                        ? ""
                        : `- [${item.title}(${item.url})]`
                )
                .filter((item) => item !== "")
                .join("\n")
        })
        .with({ type: "socials" }, (b): string | undefined => {
            return b.links
                .map((link) => `* [${link.text}](${link.url})`)
                .join("\n")
        })
        .exhaustive()
}
