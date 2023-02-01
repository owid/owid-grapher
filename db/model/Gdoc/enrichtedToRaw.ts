import {
    OwidEnrichedArticleBlock,
    OwidRawArticleBlock,
    RawBlockAdditionalCharts,
    RawBlockAside,
    RawBlockChart,
    RawBlockChartStory,
    RawBlockFixedGraphic,
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
    RawRecircItem,
    excludeUndefined,
    RawBlockHorizontalRule,
    RawSDGGridItem,
    RawBlockSDGToc,
    RawBlockMissingData,
} from "@ourworldindata/utils"
import { spanToHtmlString } from "./gdocUtils.js"
import { match, P } from "ts-pattern"

function spansToHtmlText(spans: Span[]): string {
    return spans.map(spanToHtmlString).join("")
}
export function enrichedBlockToRawBlock(
    block: OwidEnrichedArticleBlock
): OwidRawArticleBlock {
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
            { type: "fixed-graphic" },
            (b): RawBlockFixedGraphic => ({
                type: b.type,
                value: excludeUndefined([
                    enrichedBlockToRawBlock(b.graphic),
                    ...b.text.map(enrichedBlockToRawBlock),
                    b.position
                        ? { type: "position", value: b.position }
                        : undefined,
                ]),
            })
        )
        .with(
            { type: "image" },
            (b): RawBlockImage => ({
                type: b.type,
                value: {
                    src: b.src,
                    caption: spansToHtmlText(b.caption),
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
                value: [
                    {
                        title: spansToHtmlText([b.title]),
                        list: b.items.map(
                            (listItem): RawRecircItem => ({
                                article: listItem.article.text,
                                author: listItem.author.text,
                                url: listItem.url,
                            })
                        ),
                    },
                ],
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
            (b): OwidRawArticleBlock => ({
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
        .exhaustive()
}
