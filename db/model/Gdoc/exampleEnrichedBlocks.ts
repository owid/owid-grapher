import {
    BlockImageSize,
    EnrichedBlockChart,
    EnrichedBlockText,
    HorizontalAlign,
    OwidEnrichedGdocBlock,
    Span,
    SpanSimpleText,
} from "@ourworldindata/types"

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
    "all-charts": {
        type: "all-charts",
        heading: "All our charts on Poverty",
        top: [{ url: "https://ourworldindata.org/grapher/poverty-over-time" }],
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
            {
                type: "text",
                value: [
                    {
                        spanType: "span-simple-text",
                        text: "I am a callout block. I highlight information.",
                    },
                ],
                parseErrors: [],
            },
            {
                type: "text",
                value: [
                    {
                        spanType: "span-simple-text",
                        text: "I am a second paragraph in the callout block.",
                    },
                ],
                parseErrors: [],
            },
            {
                type: "list",
                items: [enrichedBlockText],
                parseErrors: [],
            },
            {
                type: "heading",
                level: 1,
                text: [spanSimpleText],
                parseErrors: [],
            },
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
    video: {
        type: "video",
        url: "https://ourworldindata.org/assets/videos/example.mp4",
        filename: "https://ourworldindata.org/assets/images/example-poster.jpg",
        caption: boldLinkExampleText,
        shouldLoop: true,
        shouldAutoplay: false,
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
    "expandable-paragraph": {
        type: "expandable-paragraph",
        items: [enrichedBlockText],
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
    "key-insights": {
        type: "key-insights",
        heading: "Key Insights on Poverty",
        insights: [
            {
                title: "Key insight number 1",
                type: "key-insight-slide",
                filename: "static_chart.svg",
                content: [
                    {
                        type: "text",
                        parseErrors: [],
                        value: [
                            {
                                spanType: "span-simple-text",
                                text: "I am the first paragraph of the first insight.",
                            },
                        ],
                    },
                    {
                        type: "text",
                        parseErrors: [],
                        value: [
                            {
                                spanType: "span-simple-text",
                                text: "I am the second paragraph of the first insight.",
                            },
                        ],
                    },
                ],
            },
            {
                title: "Key insight number 2",
                type: "key-insight-slide",
                url: "https://ourworldindata.org/grapher/some_grapher",
                content: [
                    {
                        type: "text",
                        parseErrors: [],
                        value: [
                            {
                                spanType: "span-simple-text",
                                text: "I am the first paragraph of the second insight.",
                            },
                        ],
                    },
                    {
                        type: "text",
                        parseErrors: [],
                        value: [
                            {
                                spanType: "span-simple-text",
                                text: "I am the second paragraph of the second insight.",
                            },
                        ],
                    },
                ],
            },
        ],
        parseErrors: [],
    },
    "research-and-writing": {
        type: "research-and-writing",
        parseErrors: [],
        primary: [
            {
                value: {
                    url: "https://docs.google.com/document/d/abcd",
                },
            },
        ],
        secondary: [
            {
                value: {
                    url: "https://docs.google.com/document/d/1234",
                },
            },
            {
                value: {
                    url: "https://docs.google.com/document/d/5678",
                },
            },
        ],
        more: {
            heading: "More Key Articles on Poverty",
            articles: [
                {
                    value: {
                        url: "https://docs.google.com/document/d/abcd",
                    },
                },
                {
                    value: {
                        url: "https://ourworldindata.org/a-wordpress-article",
                        title: "A wordpress article",
                        authors: ["Max Roser"],
                        filename: "some_image.png",
                    },
                },
                {
                    value: {
                        url: "https://ourworldindata.org/another-wordpress-article",
                        title: "Another wordpress article",
                        authors: ["Max Roser"],
                        filename: "another_image.png",
                    },
                },
            ],
        },
        rows: [
            {
                heading: "More articles on this topic",
                articles: [
                    {
                        value: {
                            url: "https://docs.google.com/document/d/abcd",
                        },
                    },
                    {
                        value: {
                            url: "https://ourworldindata.org/yet-another-wordpress-article",
                            title: "Yet another wordpress article",
                            authors: ["Hannah Ritchie"],
                            filename: "yet_another_image.png",
                        },
                    },
                ],
            },
        ],
    },
    align: {
        type: "align",
        alignment: HorizontalAlign.center,
        content: [enrichedBlockText],
        parseErrors: [],
    },
    "entry-summary": {
        type: "entry-summary",
        items: [{ text: "Hello", slug: "#link-to-something" }],
        parseErrors: [],
    },
    table: {
        type: "table",
        template: "header-row",
        size: "narrow",
        rows: [
            {
                type: "table-row",
                cells: [
                    {
                        type: "table-cell",
                        content: [
                            {
                                type: "text",
                                value: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "City",
                                    },
                                ],
                                parseErrors: [],
                            },
                            {
                                type: "text",
                                value: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "Continent",
                                    },
                                ],
                                parseErrors: [],
                            },
                        ],
                    },
                    {
                        type: "table-cell",
                        content: [
                            {
                                type: "text",
                                value: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "Wellington",
                                    },
                                ],
                                parseErrors: [],
                            },
                            {
                                type: "text",
                                value: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "Zealandia",
                                    },
                                ],
                                parseErrors: [],
                            },
                        ],
                    },
                    {
                        type: "table-cell",
                        content: [
                            {
                                type: "text",
                                value: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "Addis Ababa",
                                    },
                                ],
                                parseErrors: [],
                            },
                            {
                                type: "text",
                                value: [
                                    {
                                        spanType: "span-simple-text",
                                        text: "Africa",
                                    },
                                ],
                                parseErrors: [],
                            },
                        ],
                    },
                ],
            },
        ],
        parseErrors: [],
    },
    ["explorer-tiles"]: {
        type: "explorer-tiles",
        title: "Explore the data",
        subtitle:
            "Our explorers show even more data than our normal visualizations.",
        explorers: [
            { url: "https://ourworldindata.org/explorers/energy" },
            { url: "https://ourworldindata.org/explorers/poverty-explorer" },
        ],
        parseErrors: [],
    },
    blockquote: {
        type: "blockquote",
        text: [enrichedBlockText],
        citation: "Max Roser",
        parseErrors: [],
    },
    "key-indicator": {
        type: "key-indicator",
        datapageUrl: "https://ourworldindata.org/grapher/life-expectancy",
        title: "How did people's life expectancy change over time?",
        text: [enrichedBlockText],
        parseErrors: [],
    },
    "key-indicator-collection": {
        type: "key-indicator-collection",
        blocks: [
            {
                type: "key-indicator",
                datapageUrl:
                    "https://ourworldindata.org/grapher/life-expectancy",
                title: "How did people's life expectancy change over time?",
                text: [enrichedBlockText],
                parseErrors: [],
            },
            {
                type: "key-indicator",
                datapageUrl:
                    "https://ourworldindata.org/grapher/share-of-population-in-extreme-poverty",
                title: "What share of the population is living in extreme poverty?",
                text: [enrichedBlockText],
                parseErrors: [],
            },
        ],
        parseErrors: [],
    },
    "pill-row": {
        type: "pill-row",
        title: "Recently updated",
        pills: [
            { text: "Energy", url: "https://ourworldindata.org/energy" },
            { text: "Poverty", url: "https://ourworldindata.org/poverty" },
        ],
        parseErrors: [],
    },
    "homepage-search": {
        type: "homepage-search",
        parseErrors: [],
    },
    "homepage-intro": {
        type: "homepage-intro",
        featuredWork: [
            {
                type: "primary",
                url: "https://ourworldindata.org/optimism-and-pessimism",
                title: "Optimism & Pessimism",
                description:
                    "Why are so many people pessimistic about the future?",
                kicker: "Article - 10 Mins",
                filename: "optimism-and-pessimism.jpg",
                authors: ["Our World In Data"],
            },
            {
                type: "secondary",
                url: "https://ourworldindata.org/flu-deaths",
                title: "How many people die from the flu?",
                description:
                    "The risk of death from influenza has declined over time, but globally, hundreds of thousands of people still die from the disease each year.",
                kicker: "Article - 10 Mins",
                filename: "optimism-and-pessimism.jpg",
                authors: ["Our World In Data"],
            },
            {
                type: "secondary",
                url: "https://ourworldindata.org/something",
                title: "Is this a rhetorical question?",
                description: "Blah blah",
                kicker: "Article - 10 Mins",
                filename: "featured-image.jpg",
                authors: ["Max Roser"],
            },
            {
                type: "tertiary",
                url: "https://ourworldindata.org/front-end-engineer",
                title: "We’re looking for a front-end engineer to join our team.",
                kicker: "Announcement",
                authors: ["Our World In Data"],
            },
            {
                type: "tertiary",
                url: "https://ourworldindata.org/civil-engineer",
                title: "We’re looking to build bridges with a civil engineer.",
                kicker: "Announcement",
                authors: ["Our World In Data"],
            },
        ],
        parseErrors: [],
    },
    "latest-data-insights": {
        type: "latest-data-insights",
        parseErrors: [],
    },
}
