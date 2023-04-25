import {
    BlockImageSize,
    EnrichedBlockChart,
    EnrichedBlockText,
    OwidEnrichedGdocBlock,
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

export const enrichedBlockExamples: Record<
    OwidEnrichedGdocBlock["type"],
    OwidEnrichedGdocBlock
> = {
    text: enrichedBlockText,
    "simple-text": {
        type: "simple-text",
        value: {
            spanType: "span-simple-text",
            text: "This is a simple text block",
        },
        parseErrors: [],
    },
    aside: {
        type: "aside",
        position: "right",
        caption: boldLinkExampleText,
        parseErrors: [],
    },
    chart: {
        type: "chart",
        url: "https://ourworldindata.org/grapher/total-cases-covid-19",
        height: "400",
        row: "1",
        column: "1",
        position: "featured",
        caption: boldLinkExampleText,
        parseErrors: [],
    },
    scroller: {
        type: "scroller",
        blocks: [
            {
                url: "https://ourworldindata.org/grapher/total-cases-covid-19",
                text: enrichedBlockText,
                type: "enriched-scroller-item",
            },
        ],
        parseErrors: [],
    },
    callout: {
        type: "callout",
        parseErrors: [],
        text: [
            [
                {
                    spanType: "span-simple-text",
                    text: "I am a callout block. I highlight information.",
                },
            ],
            [
                {
                    spanType: "span-simple-text",
                    text: "I am a second paragraph in the callout block.",
                },
            ],
        ],
        title: "Hey, listen!",
    },
    "chart-story": {
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
    "additional-charts": {
        type: "additional-charts",
        items: [boldLinkExampleText],
        parseErrors: [],
    },
    image: {
        type: "image",
        filename: "example.png",
        alt: "",
        size: BlockImageSize.Wide,
        parseErrors: [],
    },
    list: {
        type: "list",
        items: [enrichedBlockText],
        parseErrors: [],
    },
    "numbered-list": {
        type: "numbered-list",
        items: [enrichedBlockText],
        parseErrors: [],
    },
    "pull-quote": {
        type: "pull-quote",
        text: [spanSimpleText],
        parseErrors: [],
    },
    "horizontal-rule": {
        type: "horizontal-rule",
        value: {},
        parseErrors: [],
    },
    recirc: {
        type: "recirc",
        title: spanSimpleText,
        links: [
            {
                url: "https://docs.google.com/document/d/abcd-1234/edit",
                type: "recirc-link",
            },
        ],
        parseErrors: [],
    },
    html: {
        type: "html",
        value: "<p>This is a paragraph</p>",
        parseErrors: [],
    },
    heading: {
        type: "heading",
        level: 1,
        text: boldLinkExampleText,
        supertitle: boldLinkExampleText,
        parseErrors: [],
    },
    "sdg-grid": {
        type: "sdg-grid",
        items: [
            {
                goal: "A test goal",
                link: "https://ourworldindata.org/grapher/total-cases-covid-19",
            },
        ],
        parseErrors: [],
    },
    "sticky-right": {
        type: "sticky-right",
        left: [enrichedBlockText],
        right: [enrichedBlockText],
        parseErrors: [],
    },
    "sticky-left": {
        type: "sticky-left",
        left: [enrichedBlockText],
        right: [enrichedBlockText],
        parseErrors: [],
    },
    "side-by-side": {
        type: "side-by-side",
        left: [enrichedBlockText],
        right: [enrichedBlockText],
        parseErrors: [],
    },
    "gray-section": {
        type: "gray-section",
        items: [enrichedBlockText],
        parseErrors: [],
    },
    "prominent-link": {
        type: "prominent-link",
        url: "https://ourworldindata.org/grapher/total-cases-covid-19",
        title: "A test title",
        description: "A test description",
        thumbnail: "filename.svg",
        parseErrors: [],
    },
    "sdg-toc": {
        type: "sdg-toc",
        value: {},
        parseErrors: [],
    },
    "missing-data": {
        type: "missing-data",
        value: {},
        parseErrors: [],
    },
    "topic-page-intro": {
        type: "topic-page-intro",
        downloadButton: {
            text: "Download all data on poverty",
            url: "https://github.com/owid/etl",
            type: "topic-page-intro-download-button",
        },
        relatedTopics: [
            {
                text: "Poverty",
                url: "https://ourworldindata.org/poverty",
                type: "topic-page-intro-related-topic",
            },
        ],
        content: [
            {
                type: "text",
                parseErrors: [],
                value: [
                    {
                        spanType: "span-simple-text",
                        text: "I am the first paragraph of the intro to the topic page.",
                    },
                ],
            },
            {
                type: "text",
                parseErrors: [],
                value: [
                    {
                        spanType: "span-simple-text",
                        text: "I am the second paragraph of the intro to the topic page.",
                    },
                ],
            },
        ],
        parseErrors: [],
    },
}
