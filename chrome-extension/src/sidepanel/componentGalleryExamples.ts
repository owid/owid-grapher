import { enrichedBlockExamples } from "@owid/db/model/Gdoc/exampleEnrichedBlocks.js"
import type { OwidEnrichedGdocBlock, BlockSize } from "@ourworldindata/types"
import type { Attachments } from "../shared/types.js"

// Types for component metadata
export interface ComponentFieldInfo {
    name: string
    description: string
    required: boolean
}

export interface ComponentMetadata {
    type: string
    description: string
    fields: ComponentFieldInfo[]
}

// Components to include in the gallery (Parts 2 and 3 of the documentation)
export const GALLERY_COMPONENT_TYPES: OwidEnrichedGdocBlock["type"][] = [
    // Part Two: Components (21)
    "chart",
    "narrative-chart",
    "guided-chart",
    "aside",
    "pull-quote",
    "blockquote",
    "recirc",
    "subscribe-banner",
    "chart-story",
    "horizontal-rule",
    "additional-charts",
    "image",
    "video",
    "static-viz",
    "prominent-link",
    "cta",
    "callout",
    "resource-panel",
    "expandable-paragraph",
    "table",
    "expander",
    // Part Three: Layouts (5)
    "sticky-right",
    "sticky-left",
    "side-by-side",
    "align",
    "gray-section",
]

// Metadata for each component - descriptions and field documentation
export const componentMetadata: Record<string, ComponentMetadata> = {
    // Part Two: Components
    chart: {
        type: "chart",
        description:
            "Embed any Grapher chart, explorer, or multidimensional chart. The URL determines what's displayed.",
        fields: [
            {
                name: "url",
                description: "URL to the chart, explorer, or mdim",
                required: true,
            },
            {
                name: "size",
                description: '"narrow", "wide", or "widest" (default: "wide")',
                required: false,
            },
            {
                name: "height",
                description: "Chart height in pixels as string",
                required: false,
            },
            {
                name: "caption",
                description: "Caption below the chart (rich text)",
                required: false,
            },
            {
                name: "visibility",
                description:
                    '"mobile" or "desktop" - show only on specific devices',
                required: false,
            },
        ],
    },
    "narrative-chart": {
        type: "narrative-chart",
        description:
            "Chart derivative viewed only in articles. Preferred for embedding charts with fixed settings.",
        fields: [
            {
                name: "name",
                description: "Name of the narrative chart (created via admin)",
                required: true,
            },
            {
                name: "size",
                description: '"narrow", "wide", or "widest" (default: "wide")',
                required: false,
            },
            {
                name: "height",
                description: "Chart height in pixels as string",
                required: false,
            },
            {
                name: "caption",
                description: "Caption below the chart (rich text)",
                required: false,
            },
        ],
    },
    "guided-chart": {
        type: "guided-chart",
        description:
            "Chart that can be controlled by links in paragraph text. Use with sticky layouts.",
        fields: [
            {
                name: "content",
                description:
                    "Contains the chart and text with #guide: links. Links use syntax: #guide:https://ourworldindata.org/grapher/slug?params",
                required: true,
            },
        ],
    },
    aside: {
        type: "aside",
        description: "Small caption placed to the left or right of body text.",
        fields: [
            {
                name: "caption",
                description: "The aside text (rich text)",
                required: true,
            },
            {
                name: "position",
                description: '"left" or "right" (default: "right")',
                required: false,
            },
        ],
    },
    "pull-quote": {
        type: "pull-quote",
        description:
            "Centered, italicized h1 quote re-emphasizing a phrase from the article.",
        fields: [
            { name: "quote", description: "The quote text", required: true },
            {
                name: "align",
                description:
                    '"left", "left-center", "right-center", or "right"',
                required: true,
            },
            {
                name: "content",
                description: "The paragraph content the quote is inserted into",
                required: true,
            },
        ],
    },
    blockquote: {
        type: "blockquote",
        description: "Citation excerpt from another source.",
        fields: [
            {
                name: "text",
                description: "The quoted text (array of text blocks)",
                required: true,
            },
            {
                name: "citation",
                description: "Source attribution (text or URL)",
                required: false,
            },
        ],
    },
    recirc: {
        type: "recirc",
        description:
            "Gray block linking to related content. Placed to the right of text.",
        fields: [
            {
                name: "title",
                description: 'Heading text (e.g., "More Articles on Mammals")',
                required: true,
            },
            {
                name: "links",
                description:
                    "Array of link objects with url, optional title/subtitle",
                required: true,
            },
            {
                name: "align",
                description: '"left", "center", or "right"',
                required: false,
            },
        ],
    },
    "subscribe-banner": {
        type: "subscribe-banner",
        description:
            "Newsletter subscription call-to-action block. Added automatically to articles - use hide-subscribe-banner in front-matter to disable.",
        fields: [
            {
                name: "align",
                description: '"left", "center", or "right" (default: "center")',
                required: false,
            },
        ],
    },
    "chart-story": {
        type: "chart-story",
        description:
            "Carousel of charts with narrative and technical text below.",
        fields: [
            {
                name: "items",
                description:
                    "Array of slides, each with: narrative (required), chart (required), technical (optional)",
                required: true,
            },
        ],
    },
    "horizontal-rule": {
        type: "horizontal-rule",
        description:
            "Thin gray line dividing large sections. Should precede h1 headings.",
        fields: [],
    },
    "additional-charts": {
        type: "additional-charts",
        description: "Subtle block linking to multiple charts.",
        fields: [
            {
                name: "items",
                description: "List of links as rich text spans",
                required: true,
            },
        ],
    },
    image: {
        type: "image",
        description: "Static image with optional caption and sizing options.",
        fields: [
            {
                name: "filename",
                description: "Image filename (uploaded via admin)",
                required: true,
            },
            {
                name: "size",
                description: '"narrow", "wide", or "widest" (default: "wide")',
                required: false,
            },
            {
                name: "hasOutline",
                description:
                    '"true" or "false" (default: "true") - add gray outline for white backgrounds',
                required: false,
            },
            {
                name: "alt",
                description: "Alt text (overrides default from admin)",
                required: false,
            },
            {
                name: "caption",
                description: "Caption below image (rich text)",
                required: false,
            },
            {
                name: "smallFilename",
                description: "Different image for mobile (min 1600px wide)",
                required: false,
            },
            {
                name: "visibility",
                description: '"mobile" or "desktop"',
                required: false,
            },
        ],
    },
    video: {
        type: "video",
        description: "Short video with poster image.",
        fields: [
            {
                name: "url",
                description: "Video URL (hosted on CloudFlare, must be .mp4)",
                required: true,
            },
            {
                name: "filename",
                description: "Poster image filename (first frame of video)",
                required: true,
            },
            {
                name: "shouldLoop",
                description: '"true" or "false" (default: "false")',
                required: false,
            },
            {
                name: "shouldAutoplay",
                description: '"true" or "false" (default: "false")',
                required: false,
            },
            {
                name: "caption",
                description: "Caption below video (rich text, supports links)",
                required: false,
            },
            {
                name: "visibility",
                description: '"mobile" or "desktop"',
                required: false,
            },
        ],
    },
    "static-viz": {
        type: "static-viz",
        description:
            "Enhanced image for flagship visualizations with download modal.",
        fields: [
            {
                name: "name",
                description: "Static viz name (created via admin)",
                required: true,
            },
            {
                name: "size",
                description: '"narrow", "wide", or "widest" (default: "wide")',
                required: false,
            },
            {
                name: "hasOutline",
                description: '"true" or "false" (default: "true")',
                required: false,
            },
        ],
    },
    "prominent-link": {
        type: "prominent-link",
        description: "Large link card with thumbnail, title, and description.",
        fields: [
            {
                name: "url",
                description: "Link URL (gdoc link or external URL)",
                required: true,
            },
            {
                name: "title",
                description: "Title (auto-fetched for gdoc links)",
                required: false,
            },
            {
                name: "description",
                description: "Description text",
                required: false,
            },
            {
                name: "thumbnail",
                description: "Thumbnail image filename",
                required: false,
            },
        ],
    },
    cta: {
        type: "cta",
        description:
            "Simple link with an arrow. Blue in data insights, red elsewhere.",
        fields: [
            { name: "url", description: "Link URL", required: true },
            { name: "text", description: "Link text", required: true },
        ],
    },
    callout: {
        type: "callout",
        description:
            "Gray block highlighting meta-textual information like update notices.",
        fields: [
            {
                name: "text",
                description: "Content (array of text, heading, or list blocks)",
                required: true,
            },
            { name: "title", description: "Title text", required: false },
            {
                name: "icon",
                description: 'Icon type ("info" is the only supported value)',
                required: false,
            },
        ],
    },
    "resource-panel": {
        type: "resource-panel",
        description:
            "Sidebar CTA for linear topic pages linking to charts and data catalog.",
        fields: [
            {
                name: "title",
                description: 'Main title (e.g., "Data on this topic")',
                required: true,
            },
            {
                name: "links",
                description: "Array of chart links with optional subtitle",
                required: true,
            },
            {
                name: "kicker",
                description: 'Small label text (e.g., "Resources")',
                required: false,
            },
            {
                name: "buttonText",
                description: "Button text for data catalog link",
                required: false,
            },
            {
                name: "icon",
                description: 'Icon type ("chart" is the only supported value)',
                required: false,
            },
        ],
    },
    "expandable-paragraph": {
        type: "expandable-paragraph",
        description:
            'Content with "Show More" toggle for progressive disclosure.',
        fields: [
            {
                name: "items",
                description: "Content blocks to show/hide",
                required: true,
            },
        ],
    },
    table: {
        type: "table",
        description: "Tables using Google Docs table element.",
        fields: [
            {
                name: "rows",
                description: "Table row data (from GDoc table)",
                required: true,
            },
            {
                name: "template",
                description:
                    '"header-row", "header-column", or "header-column-row" (default: "header-row")',
                required: false,
            },
            {
                name: "size",
                description: '"narrow" or "wide" (default: "narrow")',
                required: false,
            },
            {
                name: "caption",
                description: "Table caption (rich text, supports links)",
                required: false,
            },
        ],
    },
    expander: {
        type: "expander",
        description:
            "Collapsible box for long content like tables or technical text.",
        fields: [
            {
                name: "title",
                description: "Main title shown when collapsed",
                required: true,
            },
            {
                name: "content",
                description: "Content blocks shown when expanded",
                required: true,
            },
            {
                name: "heading",
                description:
                    'Small heading above title (e.g., "Additional information")',
                required: false,
            },
            {
                name: "subtitle",
                description: "Subtitle below title",
                required: false,
            },
        ],
    },
    // Part Three: Layouts
    "sticky-right": {
        type: "sticky-right",
        description:
            "Two-column layout where right column stays fixed while left scrolls. Collapses at tablet.",
        fields: [
            {
                name: "left",
                description:
                    "Array of content blocks for scrolling left column",
                required: true,
            },
            {
                name: "right",
                description: "Array of content blocks for sticky right column",
                required: true,
            },
        ],
    },
    "sticky-left": {
        type: "sticky-left",
        description:
            "Two-column layout where left column stays fixed while right scrolls. Collapses at tablet.",
        fields: [
            {
                name: "left",
                description: "Array of content blocks for sticky left column",
                required: true,
            },
            {
                name: "right",
                description:
                    "Array of content blocks for scrolling right column",
                required: true,
            },
        ],
    },
    "side-by-side": {
        type: "side-by-side",
        description:
            "Two equal columns side by side. Collapses at smartphone breakpoint.",
        fields: [
            {
                name: "left",
                description: "Array of content blocks for left column",
                required: true,
            },
            {
                name: "right",
                description: "Array of content blocks for right column",
                required: true,
            },
        ],
    },
    align: {
        type: "align",
        description:
            "Aligns text content (and headings) within the block. Does not affect images/charts.",
        fields: [
            {
                name: "alignment",
                description:
                    'HorizontalAlign value - "left", "center", or "right"',
                required: true,
            },
            {
                name: "content",
                description: "Array of content blocks to align",
                required: true,
            },
        ],
    },
    "gray-section": {
        type: "gray-section",
        description:
            "Full-width section with gray background. Can contain any ArchieML content.",
        fields: [
            {
                name: "items",
                description: "Array of content blocks inside the gray section",
                required: true,
            },
        ],
    },
}

// All examples with realistic data overrides
const allExamples: Record<
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

// Filter to only include components from Parts 2 and 3 of the documentation
export const galleryExamples = Object.fromEntries(
    GALLERY_COMPONENT_TYPES.filter((type) => type in allExamples).map(
        (type) => [type, allExamples[type]]
    )
) as Partial<Record<OwidEnrichedGdocBlock["type"], OwidEnrichedGdocBlock>>

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
