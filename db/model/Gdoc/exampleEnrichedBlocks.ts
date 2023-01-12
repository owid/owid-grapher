import {
    EnrichedBlockChart,
    EnrichedBlockText,
    OwidEnrichedArticleBlock,
    Span,
    SpanSimpleText,
} from "@ourworldindata/utils"

const spanSimpleText: SpanSimpleText = {
    spanType: "span-simple-text",
    text: "This is a text block with",
}

const boldLinkExampleText: Span[] = [
    {
        spanType: "span-simple-text",
        text: "This is a text block with ",
    },
    {
        spanType: "span-bold",
        children: [
            {
                spanType: "span-link",
                url: "https://ourworldindata.org",
                children: [
                    {
                        spanType: "span-simple-text",
                        text: "a link",
                    },
                ],
            },
        ],
    },
]

const enrichedBlockText: EnrichedBlockText = {
    type: "text",
    value: boldLinkExampleText,
    parseErrors: [],
}

const enrichedChart: EnrichedBlockChart = {
    type: "chart",
    url: "https://ourworldindata.org/grapher/total-cases-covid-19",
    parseErrors: [],
}

export const enrichedBlockExamples: OwidEnrichedArticleBlock[] = [
    enrichedBlockText,
    {
        type: "aside",
        position: "right",
        caption: boldLinkExampleText,
        parseErrors: [],
    },
    {
        type: "chart",
        url: "https://ourworldindata.org/grapher/total-cases-covid-19",
        height: "400",
        row: "1",
        column: "1",
        position: "featured",
        caption: boldLinkExampleText,
        parseErrors: [],
    },
    {
        type: "scroller",
        blocks: [
            {
                url: "https://ourworldindata.org/grapher/total-cases-covid-19",
                text: enrichedBlockText,
            },
        ],
        parseErrors: [],
    },
    {
        type: "chart-story",
        items: [
            {
                narrative: enrichedBlockText,
                chart: enrichedChart,
                technical: [enrichedBlockText],
            },
        ],
        parseErrors: [],
    },
    {
        type: "additional-charts",
        items: [boldLinkExampleText],
        parseErrors: [],
    },
    {
        type: "fixed-graphic",
        graphic: enrichedChart,
        text: [enrichedBlockText],
        position: "right",
        parseErrors: [],
    },
    {
        type: "image",
        src: "https://ourworldindata.org/uploads/2022/03/Future-as-triangles-of-an-hour-glass-01.png",
        caption: boldLinkExampleText,
        parseErrors: [],
    },
    {
        type: "list",
        items: [enrichedBlockText],
        parseErrors: [],
    },
    {
        type: "numbered-list",
        items: [enrichedBlockText],
        parseErrors: [],
    },
    {
        type: "pull-quote",
        text: [spanSimpleText],
        parseErrors: [],
    },
    {
        type: "horizontal-rule",
        value: {},
        parseErrors: [],
    },
    {
        type: "recirc",
        title: spanSimpleText,
        items: [
            {
                article: spanSimpleText,
                author: spanSimpleText,
                url: "https://ourworldindata.org/grapher/total-cases-covid-19",
            },
        ],
        parseErrors: [],
    },
    {
        type: "html",
        value: "<p>This is a paragraph</p>",
        parseErrors: [],
    },
    {
        type: "heading",
        level: 1,
        text: boldLinkExampleText,
        supertitle: boldLinkExampleText,
        parseErrors: [],
    },
    {
        type: "sdg-grid",
        items: [
            {
                goal: "A test goal",
                link: "https://ourworldindata.org/grapher/total-cases-covid-19",
            },
        ],
        parseErrors: [],
    },
    {
        type: "sticky-right",
        left: [enrichedBlockText],
        right: [enrichedBlockText],
        parseErrors: [],
    },
    {
        type: "sticky-left",
        left: [enrichedBlockText],
        right: [enrichedBlockText],
        parseErrors: [],
    },
    {
        type: "side-by-side",
        left: [enrichedBlockText],
        right: [enrichedBlockText],
        parseErrors: [],
    },
    {
        type: "grey-section",
        items: [enrichedBlockText],
        parseErrors: [],
    },
    {
        type: "prominent-link",
        url: "https://ourworldindata.org/grapher/total-cases-covid-19",
        title: "A test title",
        description: "A test description",
        parseErrors: [],
    },
    {
        type: "sdg-toc",
        value: {},
        parseErrors: [],
    },
    {
        type: "missing-data",
        value: {},
        parseErrors: [],
    },
    {
        type: "additional-charts",
        items: [boldLinkExampleText],
        parseErrors: [],
    },
]
