import {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
    RawBlockAllCharts,
    RawBlockAdditionalCharts,
    RawBlockAside,
    RawBlockChart,
    RawBlockChartStory,
    RawBlockGraySection,
    RawBlockHeading,
    RawBlockHtml,
    RawBlockImage,
    RawBlockList,
    RawBlockNumberedList,
    RawBlockProminentLink,
    RawBlockPullQuote,
    RawBlockRecirc,
    RawBlockScroller,
    RawBlockSDGGrid,
    RawBlockText,
    Span,
    RawRecircLink,
    RawBlockHorizontalRule,
    RawSDGGridItem,
    RawBlockSDGToc,
    RawBlockMissingData,
    RawBlockCallout,
    RawBlockExpandableParagraph,
    RawBlockKeyInsights,
    RawBlockResearchAndWriting,
    RawBlockTopicPageIntro,
    EnrichedBlockResearchAndWritingLink,
    RawBlockResearchAndWritingLink,
    RawBlockAlign,
    RawBlockEntrySummary,
    RawBlockVideo,
    RawBlockTable,
    RawBlockBlockquote,
} from "@ourworldindata/utils"
import { match, P } from "ts-pattern"

export function spanToMarkdown(s: Span): string {
    return match(s)
        .with({ spanType: "span-simple-text" }, (span) => span.text)
        .with({ spanType: "span-newline" }, () => "\n  ")
        .with(
            { spanType: "span-link" },
            (link) => `[${spansToMarkdown(link.children)}](${link.url})`
        )
        .with(
            { spanType: "span-italic" },
            (span) => `_${spansToMarkdown(span.children)}_`
        )
        .with(
            { spanType: "span-bold" },
            (span) => `**${spansToMarkdown(span.children)}**`
        )
        .with(
            {
                spanType: P.union(
                    "span-ref",
                    "span-dod",
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

export function spansToMarkdown(spans: Span[]): string {
    return spans.map((span) => spanToMarkdown(span)).join("")
}

function markdownComponent(
    componentName: string,
    attributes: Record<string, string>,
    exportComponents: boolean
): string | undefined {
    const attributesString = Object.entries(attributes)
        .map(([key, val]) => `${key}: ${val}`)
        .join(" ")
    if (exportComponents) return `<${componentName} ${attributesString}/>`
    else return undefined
}

export function enrichedBlockToMarkdown(
    block: OwidEnrichedGdocBlock,
    exportComponents: boolean
): string | undefined {
    return match(block)
        .with({ type: "text" }, (b) => spansToMarkdown(b.value))
        .with({ type: "simple-text" }, (b) => b.value.text)
        .with({ type: "all-charts" }, (b) =>
            markdownComponent(
                "AllCharts",
                { heading: b.heading },
                exportComponents
            )
        )
        .with({ type: "additional-charts" }, (b) => {
            if (!exportComponents) return undefined
            else {
                const items = b.items
                    .map((i) => `* ${spansToMarkdown}`)
                    .join("\n")
                return `<AdditionalCharts>
${items}
</AdditionalCharts>`
            }
        })
        .with(
            { type: "callout" },
            (b): RawBlockCallout => ({
                type: b.type,
                value: {
                    title: b.title,
                    text: b.text.map(
                        (enriched) =>
                            enrichedBlockToRawBlock(enriched) as
                                | RawBlockText
                                | RawBlockList
                                | RawBlockHeading
                    ),
                },
            })
        )
        .with(
            { type: "chart" },
            (b): RawBlockChart => ({
                type: b.type,
                value: {
                    url: b.url,
                    height: b.height,
                    row: b.row,
                    column: b.column,
                    position: b.position,
                    caption: b.caption ? spansToMarkdown(b.caption) : undefined,
                },
            })
        )
        .with(
            { type: "scroller" },
            (b): RawBlockScroller => ({
                type: b.type,
                value: b.blocks.flatMap((item) => [
                    {
                        type: "url",
                        value: item.url,
                    },
                    {
                        type: "text",
                        value: spansToMarkdown(item.text.value),
                    },
                ]),
            })
        )
        .with(
            { type: "chart-story" },
            (b): RawBlockChartStory => ({
                type: b.type,
                value: b.items.map((item) => ({
                    narrative: spansToMarkdown(item.narrative.value),
                    chart: item.chart.url,
                    technical: {
                        list: item.technical.map((t) =>
                            spansToMarkdown(t.value)
                        ),
                    },
                })),
            })
        )
        .with(
            { type: "image" },
            (b): RawBlockImage => ({
                type: b.type,
                value: {
                    filename: b.filename,
                    alt: b.alt,
                },
            })
        )
        .with(
            { type: "video" },
            (b): RawBlockVideo => ({
                type: b.type,
                value: {
                    url: b.url,
                    filename: b.filename,
                    caption: b.caption ? spansToMarkdown(b.caption) : undefined,
                    shouldLoop: String(b.shouldLoop),
                },
            })
        )
        .with(
            { type: "list" },
            (b): RawBlockList => ({
                type: b.type,
                value: b.items.map((item) => spansToMarkdown(item.value)),
            })
        )
        .with(
            { type: "pull-quote" },
            (b): RawBlockPullQuote => ({
                type: b.type,
                value: b.text.map((item) => ({
                    type: "text",
                    value: spansToMarkdown([item]),
                })),
            })
        )
        .with(
            { type: "recirc" },
            (b): RawBlockRecirc => ({
                type: b.type,
                value: {
                    title: spansToMarkdown([b.title]),
                    links: b.links.map(
                        (link): RawRecircLink => ({
                            url: link.url!,
                        })
                    ),
                },
            })
        )
        .with(
            { type: "html" },
            (b): RawBlockHtml => ({
                type: b.type,
                value: b.value,
            })
        )
        .with(
            { type: "heading" },
            (b): RawBlockHeading => ({
                type: b.type,
                value: {
                    text: b.supertitle
                        ? [
                              spansToMarkdown(b.supertitle),
                              "\u000b",
                              spansToMarkdown(b.text),
                          ].join("")
                        : spansToMarkdown(b.text),
                    level: b.level.toString(),
                },
            })
        )
        .with(
            { type: "horizontal-rule" },
            (b): RawBlockHorizontalRule => ({
                type: b.type,
                value: b.value,
            })
        )
        .with(
            { type: "sdg-grid" },
            (b): RawBlockSDGGrid => ({
                type: b.type,
                value: b.items.map(
                    (item): RawSDGGridItem => ({
                        goal: item.goal,
                        link: item.link,
                    })
                ),
            })
        )
        .with(
            { type: P.union("side-by-side", "sticky-left", "sticky-right") },
            (b): OwidRawGdocBlock => ({
                type: b.type,
                value: {
                    left: b.left.map(enrichedBlockToRawBlock),
                    right: b.right.map(enrichedBlockToRawBlock),
                },
            })
        )
        .with(
            { type: "gray-section" },
            (b): RawBlockGraySection => ({
                type: b.type,
                value: b.items.map(enrichedBlockToRawBlock),
            })
        )
        .with(
            { type: "prominent-link" },
            (b): RawBlockProminentLink => ({
                type: b.type,
                value: {
                    url: b.url,
                    title: b.title,
                    description: b.description,
                    thumbnail: b.thumbnail,
                },
            })
        )
        .with(
            { type: "sdg-toc" },
            (b): RawBlockSDGToc => ({
                type: b.type,
                value: b.value,
            })
        )
        .with(
            { type: "missing-data" },
            (b): RawBlockMissingData => ({
                type: b.type,
                value: b.value,
            })
        )
        .with(
            { type: "numbered-list" },
            (b): RawBlockNumberedList => ({
                type: b.type,
                // When going to raw blocks, include a leading "1. " so
                // that when going the reverse way we will parse the content
                // correctly as a numbered list again
                value: b.items.map(
                    (item, i) => `${i}. ${spansToMarkdown(item.value)}`
                ),
            })
        )
        .with(
            { type: "aside" },
            (b): RawBlockAside => ({
                type: b.type,
                value: {
                    position: b.position,
                    caption: spansToMarkdown(b.caption),
                },
            })
        )
        .with(
            { type: "expandable-paragraph" },
            (b): RawBlockExpandableParagraph => ({
                type: b.type,
                value: b.items.map(enrichedBlockToRawBlock),
            })
        )
        .with(
            { type: "topic-page-intro" },
            (b): RawBlockTopicPageIntro => ({
                type: b.type,
                value: {
                    "download-button": b.downloadButton
                        ? {
                              url: b.downloadButton.url,
                              text: b.downloadButton.text,
                          }
                        : undefined,
                    "related-topics": b.relatedTopics
                        ? b.relatedTopics.map((relatedTopic) => ({
                              text: relatedTopic.text,
                              url: relatedTopic.url,
                          }))
                        : undefined,
                    content: b.content.map((textBlock) => ({
                        type: "text",
                        value: spansToMarkdown(textBlock.value),
                    })),
                },
            })
        )
        .with(
            { type: "key-insights" },
            (b): RawBlockKeyInsights => ({
                type: b.type,
                value: {
                    heading: b.heading,
                    insights: b.insights.map((insight) => ({
                        title: insight.title,
                        filename: insight.filename,
                        url: insight.url,
                        content: insight.content?.map((content) =>
                            enrichedBlockToRawBlock(content)
                        ),
                    })),
                },
            })
        )
        .with(
            { type: "research-and-writing" },
            (b): RawBlockResearchAndWriting => {
                function enrichedLinkToRawLink(
                    enriched: EnrichedBlockResearchAndWritingLink
                ): RawBlockResearchAndWritingLink {
                    return {
                        ...enriched.value,
                        authors: enriched.value.authors?.join(", "),
                    }
                }
                return {
                    type: b.type,
                    value: {
                        primary: b.primary.map((enriched) =>
                            enrichedLinkToRawLink(enriched)
                        ),
                        secondary: b.secondary.map((enriched) =>
                            enrichedLinkToRawLink(enriched)
                        ),
                        more: b.more
                            ? {
                                  heading: b.more.heading,
                                  articles: b.more.articles.map(
                                      enrichedLinkToRawLink
                                  ),
                              }
                            : undefined,
                        rows: b.rows.map(({ heading, articles }) => ({
                            heading: heading,
                            articles: articles.map(enrichedLinkToRawLink),
                        })),
                    },
                }
            }
        )
        .with({ type: "align" }, (b): RawBlockAlign => {
            return {
                type: b.type,
                value: {
                    alignment: b.alignment as string,
                    content: b.content.map(enrichedBlockToRawBlock),
                },
            }
        })
        .with({ type: "entry-summary" }, (b): RawBlockEntrySummary => {
            return {
                type: b.type,
                value: {
                    items: b.items,
                },
            }
        })
        .with({ type: "table" }, (b): RawBlockTable => {
            return {
                type: b.type,
                value: {
                    template: b.template,
                    rows: b.rows.map((row) => ({
                        type: row.type,
                        value: {
                            cells: row.cells.map((cell) => ({
                                type: cell.type,
                                value: cell.content.map(
                                    enrichedBlockToRawBlock
                                ),
                            })),
                        },
                    })),
                },
            }
        })
        .with({ type: "blockquote" }, (b): RawBlockBlockquote => {
            return {
                type: "blockquote",
                value: {
                    text: b.text.map((enriched) => ({
                        type: "text",
                        value: spansToMarkdown(enriched.value),
                    })),
                    citation: b.citation,
                },
            }
        })
        .exhaustive()
}
