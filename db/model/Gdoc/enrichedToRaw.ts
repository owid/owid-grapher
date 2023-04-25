import {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
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
} from "@ourworldindata/utils"
import { spanToHtmlString } from "./gdocUtils.js"
import { match, P } from "ts-pattern"
import { RawBlockTopicPageIntro } from "@ourworldindata/utils/dist/owidTypes.js"

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
            { type: "additional-charts" },
            (b): RawBlockAdditionalCharts => ({
                type: b.type,
                value: b.items.map(spansToHtmlText),
            })
        )
        .with(
            { type: "callout" },
            (b): RawBlockCallout => ({
                type: b.type,
                value: {
                    title: b.title,
                    text: b.text.map((spans) => ({
                        type: "text",
                        value: spansToHtmlText(spans),
                    })),
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
                    technical: item.technical.map((t) =>
                        spansToHtmlText(t.value)
                    ),
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
            { type: "additional-charts" },
            (b): RawBlockAdditionalCharts => ({
                type: b.type,
                value: b.items.map(spansToHtmlText),
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
        .exhaustive()
}
