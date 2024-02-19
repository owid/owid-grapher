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
    RawBlockExplorerTiles,
    RawBlockKeyIndicator,
    RawBlockKeyIndicatorCollection,
    RawBlockPillRow,
    RawBlockHomepageSearch,
    RawBlockHomepageIntro,
    RawBlockLatestDataInsights,
} from "@ourworldindata/types"
import { spanToHtmlString } from "./gdocUtils.js"
import { match, P } from "ts-pattern"

function spansToHtmlText(spans: Span[]): string {
    return spans.map(spanToHtmlString).join("")
}
export function enrichedBlockToRawBlock(
    block: OwidEnrichedGdocBlock
): OwidRawGdocBlock {
    return match(block)
        .with(
            { type: "text" },
            (b): RawBlockText => ({
                type: b.type,
                value: spansToHtmlText(b.value),
            })
        )
        .with(
            { type: "simple-text" },
            (b): RawBlockText => ({
                type: "text",
                value: b.value.text,
            })
        )
        .with(
            { type: "all-charts" },
            (b): RawBlockAllCharts => ({
                type: b.type,
                value: {
                    heading: b.heading,
                    top: b.top,
                },
            })
        )
        .with(
            { type: "additional-charts" },
            (b): RawBlockAdditionalCharts => ({
                type: b.type,
                value: {
                    list: b.items.map(spansToHtmlText),
                },
            })
        )
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
                    caption: b.caption ? spansToHtmlText(b.caption) : undefined,
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
                        value: spansToHtmlText(item.text.value),
                    },
                ]),
            })
        )
        .with(
            { type: "chart-story" },
            (b): RawBlockChartStory => ({
                type: b.type,
                value: b.items.map((item) => ({
                    narrative: spansToHtmlText(item.narrative.value),
                    chart: item.chart.url,
                    technical: {
                        list: item.technical.map((t) =>
                            spansToHtmlText(t.value)
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
                    caption: b.caption ? spansToHtmlText(b.caption) : undefined,
                    shouldLoop: String(b.shouldLoop),
                },
            })
        )
        .with(
            { type: "list" },
            (b): RawBlockList => ({
                type: b.type,
                value: b.items.map((item) => spansToHtmlText(item.value)),
            })
        )
        .with(
            { type: "pull-quote" },
            (b): RawBlockPullQuote => ({
                type: b.type,
                value: b.text.map((item) => ({
                    type: "text",
                    value: spansToHtmlText([item]),
                })),
            })
        )
        .with(
            { type: "recirc" },
            (b): RawBlockRecirc => ({
                type: b.type,
                value: {
                    title: spansToHtmlText([b.title]),
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
                              spansToHtmlText(b.supertitle),
                              "\u000b",
                              spansToHtmlText(b.text),
                          ].join("")
                        : spansToHtmlText(b.text),
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
                    (item, i) => `${i}. ${spansToHtmlText(item.value)}`
                ),
            })
        )
        .with(
            { type: "aside" },
            (b): RawBlockAside => ({
                type: b.type,
                value: {
                    position: b.position,
                    caption: spansToHtmlText(b.caption),
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
                        value: spansToHtmlText(textBlock.value),
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
        .with({ type: "explorer-tiles" }, (b): RawBlockExplorerTiles => {
            return {
                type: "explorer-tiles",
                value: {
                    title: b.title,
                    subtitle: b.subtitle,
                    explorers: b.explorers,
                },
            }
        })
        .with({ type: "blockquote" }, (b): RawBlockBlockquote => {
            return {
                type: "blockquote",
                value: {
                    text: b.text.map((enriched) => ({
                        type: "text",
                        value: spansToHtmlText(enriched.value),
                    })),
                    citation: b.citation,
                },
            }
        })
        .with({ type: "key-indicator" }, (b): RawBlockKeyIndicator => {
            return {
                type: "key-indicator",
                value: {
                    datapageUrl: b.datapageUrl,
                    title: b.title,
                    text: b.text.map((enriched) => ({
                        type: "text",
                        value: spansToHtmlText(enriched.value),
                    })),
                    source: b.source,
                },
            }
        })
        .with(
            { type: "latest-data-insights" },
            (_): RawBlockLatestDataInsights => ({
                type: "latest-data-insights",
                value: {},
            })
        )
        .with(
            { type: "key-indicator-collection" },
            (b): RawBlockKeyIndicatorCollection => {
                return {
                    type: "key-indicator-collection",
                    value: {
                        indicators: b.blocks.map(enrichedBlockToRawBlock),
                    },
                }
            }
        )
        .with({ type: "pill-row" }, (b): RawBlockPillRow => {
            return {
                type: "pill-row",
                value: {
                    title: b.title,
                    pills: b.pills,
                },
            }
        })
        .with({ type: "homepage-search" }, (_): RawBlockHomepageSearch => {
            return {
                type: "homepage-search",
                value: {},
            }
        })
        .with({ type: "homepage-intro" }, (b): RawBlockHomepageIntro => {
            return {
                type: "homepage-intro",
                value: {
                    ["featured-work"]: b.featuredWork.map(
                        ({ type, authors, ...value }) => ({
                            type,
                            value: {
                                ...value,
                                authors: authors?.join(", "),
                            },
                        })
                    ),
                },
            }
        })
        .exhaustive()
}
