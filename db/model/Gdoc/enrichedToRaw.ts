import {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
    RawBlockAllCharts,
    RawBlockAdditionalCharts,
    RawBlockAside,
    RawBlockChart,
    RawBlockChartStory,
    RawBlockDonorList,
    RawBlockGraySection,
    RawBlockHeading,
    RawBlockHtml,
    RawBlockImage,
    RawBlockList,
    RawBlockNumberedList,
    RawBlockProminentLink,
    RawBlockPullQuote,
    RawBlockGuidedChart,
    RawBlockRecirc,
    RawBlockScroller,
    RawBlockSDGGrid,
    RawBlockText,
    Span,
    RawHybridLink,
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
    RawBlockHomepageIntroPost,
    RawBlockLatestDataInsights,
    RawBlockSocials,
    RawBlockPeople,
    RawBlockPeopleRows,
    RawBlockPerson,
    RawBlockNarrativeChart,
    RawBlockCode,
    RawBlockCookieNotice,
    RawBlockSubscribeBar,
    RawBlockExpander,
    EnrichedHybridLink,
    RawBlockResourcePanel,
    RawBlockCta,
    RawBlockScript,
} from "@ourworldindata/types"
import { spanToHtmlString } from "./gdocUtils.js"
import { match, P } from "ts-pattern"
import * as R from "remeda"

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
            { type: "narrative-chart" },
            (b): RawBlockNarrativeChart => ({
                type: b.type,
                value: {
                    name: b.name,
                    height: b.height,
                    row: b.row,
                    column: b.column,
                    position: b.position,
                    caption: b.caption ? spansToHtmlText(b.caption) : undefined,
                },
            })
        )
        .with(
            { type: "code" },
            (b): RawBlockCode => ({
                type: b.type,
                value: b.text.map((text) => ({
                    type: "text",
                    value: text.value.text,
                })),
            })
        )
        .with(
            { type: "cookie-notice" },
            (b): RawBlockCookieNotice => ({
                type: b.type,
                value: {},
            })
        )
        .with(
            { type: "cta" },
            (b): RawBlockCta => ({
                type: b.type,
                value: {
                    url: b.url,
                    text: b.text,
                },
            })
        )
        .with(
            { type: "donors" },
            (b): RawBlockDonorList => ({
                type: b.type,
                value: b.value,
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
                    smallFilename: b.smallFilename,
                    alt: b.alt,
                    caption: b.caption && spansToHtmlText(b.caption),
                    size: b.size,
                    hasOutline: String(b.hasOutline),
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
            { type: "people" },
            (b): RawBlockPeople => ({
                type: b.type,
                value: b.items.map(enrichedBlockToRawBlock) as RawBlockPerson[],
            })
        )
        .with(
            { type: "people-rows" },
            (b): RawBlockPeopleRows => ({
                type: b.type,
                value: {
                    columns: b.columns,
                    people: b.people.map(
                        enrichedBlockToRawBlock
                    ) as RawBlockPerson[],
                },
            })
        )
        .with(
            { type: "person" },
            (b): RawBlockPerson => ({
                type: "person",
                value: {
                    image: b.image,
                    name: b.name,
                    title: b.title,
                    url: b.url,
                    text: b.text.map(enrichedBlockToRawBlock) as RawBlockText[],
                    socials: b.socials?.map((social) => ({
                        type: social.type,
                        url: social.url,
                        text: social.text,
                    })),
                },
            })
        )
        .with(
            { type: "pull-quote" },
            (b): RawBlockPullQuote => ({
                type: b.type,
                value: {
                    quote: b.quote,
                    align: b.align,
                    content: b.content.map(
                        (enriched) =>
                            enrichedBlockToRawBlock(enriched) as RawBlockText
                    ),
                },
            })
        )
        .with(
            { type: "guided-chart" },
            (b): RawBlockGuidedChart => ({
                type: b.type,
                value: b.content.map(
                    (enriched) =>
                        enrichedBlockToRawBlock(enriched) as RawBlockText
                ),
            })
        )
        .with(
            { type: "recirc" },
            (b): RawBlockRecirc => ({
                type: b.type,
                value: {
                    title: b.title,
                    align: b.align,
                    links: b.links.map(convertEnrichedHybridLinksToRaw),
                },
            })
        )
        .with(
            { type: "subscribe-bar" },
            (b): RawBlockSubscribeBar => ({
                type: b.type,
                value: {
                    align: b.align,
                },
            })
        )
        .with(
            { type: "resource-panel" },
            (b): RawBlockResourcePanel => ({
                type: b.type,
                value: {
                    icon: b.icon,
                    kicker: b.kicker,
                    title: b.title,
                    links: b.links.map(convertEnrichedHybridLinksToRaw),
                    buttonText: b.buttonText,
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
            { type: "script" },
            (b): RawBlockScript => ({
                type: b.type,
                value: b.lines.map((line) => ({
                    type: "text",
                    value: line,
                })),
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
            { type: "expander" },
            (b): RawBlockExpander => ({
                type: b.type,
                value: {
                    title: b.title,
                    heading: b.heading,
                    subtitle: b.subtitle,
                    content: b.content.map(enrichedBlockToRawBlock),
                },
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
                        narrativeChartName: insight.narrativeChartName,
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
                        heading: b.heading,
                        "hide-authors": b["hide-authors"].toString(),
                        "hide-date": b["hide-date"].toString(),
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
                        latest: b.latest
                            ? {
                                  heading: b.latest.heading,
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
                    size: b.size,
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
                    caption: b.caption ? spansToHtmlText(b.caption) : undefined,
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
                        ({ authors, isNew, ...value }) => {
                            const rawPost: RawBlockHomepageIntroPost = {
                                ...value,
                            }
                            if (authors) {
                                rawPost.authors = authors.join(", ")
                            }
                            if (isNew !== undefined) {
                                rawPost.isNew = String(isNew)
                            }
                            return rawPost
                        }
                    ),
                },
            }
        })
        .with({ type: "socials" }, (b): RawBlockSocials => {
            return {
                type: "socials",
                value: b.links.map(({ url, text, type }) => ({
                    url,
                    text,
                    type,
                })),
            }
        })
        .exhaustive()
}

function convertEnrichedHybridLinksToRaw(
    link: EnrichedHybridLink
): RawHybridLink {
    return R.pickBy(link, (value, key) => {
        const keys: Array<keyof EnrichedHybridLink> = [
            "title",
            "subtitle",
            "url",
        ] as const
        // These keys are optional, so we only want to serialize
        // them if they're actually there
        return !!value && keys.includes(key)
    })
}
