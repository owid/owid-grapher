import { enrichedBlockExamples } from "@owid/db/model/Gdoc/exampleEnrichedBlocks.js"
import type { OwidEnrichedGdocBlock, BlockSize } from "@ourworldindata/types"
import type { Attachments } from "../shared/types.js"

// Override specific blocks with realistic data from the database
export const galleryExamples: Record<
    OwidEnrichedGdocBlock["type"],
    OwidEnrichedGdocBlock
> = {
    ...enrichedBlockExamples,

    // Use the life-expectancy chart which exists in the DB
    chart: {
        ...enrichedBlockExamples.chart,
        url: "https://ourworldindata.org/grapher/life-expectancy",
    },

    // Use a real narrative chart name from the DB
    "narrative-chart": {
        ...enrichedBlockExamples["narrative-chart"],
        name: "a-childs-survival-in-germany-was-once-a-coin-flip",
    },

    // Use a real image filename from the DB
    image: {
        ...enrichedBlockExamples.image,
        filename: "small_multiples_map_life_expectancy.png",
        alt: "Life expectancy map showing changes over time",
    },

    // Use a real person image
    person: {
        ...enrichedBlockExamples.person,
        image: "max-roser.jpg",
    },

    // Override recirc with real article URLs
    recirc: {
        ...enrichedBlockExamples.recirc,
        links: [
            {
                url: "https://ourworldindata.org/britain-safest-roads-history",
                title: "Britain's roads are now among the safest in the world",
                type: "hybrid-link",
            },
            {
                url: "https://ourworldindata.org/air-pollution-sources",
                title: "Air pollution: sources and impacts",
                type: "hybrid-link",
            },
        ],
    },

    // Override key-insights with real chart
    "key-insights": {
        ...enrichedBlockExamples["key-insights"],
        insights: enrichedBlockExamples["key-insights"].insights.map(
            (insight, index) => ({
                ...insight,
                url:
                    index === 1
                        ? "https://ourworldindata.org/grapher/life-expectancy"
                        : insight.url,
                filename:
                    index === 0
                        ? "small_multiples_map_life_expectancy.png"
                        : insight.filename,
            })
        ),
    },

    // Override guided chart with real chart URL
    "guided-chart": {
        type: "guided-chart",
        content: [
            {
                type: "chart",
                url: "https://ourworldindata.org/grapher/life-expectancy",
                size: "wide" as BlockSize,
                parseErrors: [],
            },
            {
                type: "text",
                value: [
                    {
                        spanType: "span-simple-text",
                        text: "This is explanatory text that goes along with the guided chart. You can ",
                    },
                    {
                        spanType: "span-guided-chart-link",
                        url: "https://ourworldindata.org/grapher/life-expectancy?tab=map&time=2020&country=USA~GBR",
                        children: [
                            {
                                spanType: "span-simple-text",
                                text: "click here to see the map view",
                            },
                        ],
                    },
                    {
                        spanType: "span-simple-text",
                        text: " for specific countries.",
                    },
                ],
                parseErrors: [],
            },
        ],
        parseErrors: [],
    },

    // Override prominent-link with real article
    "prominent-link": {
        ...enrichedBlockExamples["prominent-link"],
        url: "https://ourworldindata.org/britain-safest-roads-history",
        title: "Britain's roads are now among the safest in the world",
        description:
            "Road deaths in Britain have fallen dramatically over time.",
    },
}

// Mock attachments for the gallery - minimal data needed for rendering
export const galleryAttachments: Attachments = {
    linkedAuthors: [],
    linkedCharts: {
        "https://ourworldindata.org/grapher/life-expectancy": {
            title: "Life expectancy",
            slug: "life-expectancy",
            id: 1,
            resolvedUrl: "https://ourworldindata.org/grapher/life-expectancy",
            tab: "chart",
            thumbnail:
                "https://ourworldindata.org/grapher/thumbnail/life-expectancy.png",
        },
    },
    linkedIndicators: {},
    linkedDocuments: {},
    imageMetadata: {
        "small_multiples_map_life_expectancy.png": {
            filename: "small_multiples_map_life_expectancy.png",
            defaultAlt:
                "Small multiples map showing life expectancy changes over time",
            originalWidth: 1200,
            originalHeight: 800,
        },
        "max-roser.jpg": {
            filename: "max-roser.jpg",
            defaultAlt: "Max Roser",
            originalWidth: 400,
            originalHeight: 400,
        },
    },
    relatedCharts: [],
    linkedNarrativeCharts: {
        "a-childs-survival-in-germany-was-once-a-coin-flip": {
            slug: "a-childs-survival-in-germany-was-once-a-coin-flip",
            configUrl:
                "/grapher/a-childs-survival-in-germany-was-once-a-coin-flip",
            queryStr: "",
        },
    },
    linkedStaticViz: {},
    tags: [{ id: 1, name: "Health", slug: "health" }],
}
