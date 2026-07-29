import { BlockSize, EnrichedBlockBespokeComponent } from "@ourworldindata/types"

export type HomepageFeaturedLinkType = "article" | "explorer" | "chart"

export interface HomepageFeaturedLink {
    title: string
    href: string
    type: HomepageFeaturedLinkType
}

export interface HomepageAreaEmbed {
    block: EnrichedBlockBespokeComponent
    /** The article the embedded viz comes from */
    sourceTitle: string
    sourceHref: string
    isDraft?: boolean
}

export interface HomepageAreaContent {
    embed?: HomepageAreaEmbed
    featured: HomepageFeaturedLink[]
}

const makeBlock = (
    bundle: string,
    variant: string,
    size: BlockSize,
    config: Record<string, string> = {}
): EnrichedBlockBespokeComponent => ({
    type: "bespoke-component",
    bundle,
    variant,
    size,
    config,
    parseErrors: [],
})

/**
 * Prototype content for the homepage topic-area sections, keyed by the area's
 * name in the topic tag graph.
 */
export const HOMEPAGE_AREA_CONTENT: Record<string, HomepageAreaContent> = {
    "Population and Demographic Change": {
        embed: {
            block: makeBlock("demography", "simulation", BlockSize.Widest, {
                region: "userLocation",
            }),
            sourceTitle:
                "Population tool: How will populations across the world change in the 21st century?",
            sourceHref: "/population-simulation-tool",
        },
        featured: [
            {
                title: "Two centuries of rapid global population growth will come to an end",
                href: "/world-population-growth-past-future",
                type: "article",
            },
            {
                title: "Population & Demography Data Explorer",
                href: "/explorers/population-and-demography",
                type: "explorer",
            },
        ],
    },
    Health: {
        embed: {
            block: makeBlock("causes-of-death", "treemap", BlockSize.Wide),
            sourceTitle: "What do people die from in different countries?",
            sourceHref: "/what-do-people-die-from-in-different-countries",
        },
        featured: [
            {
                title: "Why do women live longer than men?",
                href: "/why-do-women-live-longer-than-men",
                type: "article",
            },
            {
                title: "Life expectancy",
                href: "/grapher/life-expectancy",
                type: "chart",
            },
            {
                title: "Child mortality rate",
                href: "/grapher/child-mortality-igme",
                type: "chart",
            },
        ],
    },
    "Energy and Environment": {
        featured: [
            {
                title: "Who has contributed most to global CO₂ emissions?",
                href: "/contributed-most-global-co2",
                type: "article",
            },
            {
                title: "CO₂ emissions per capita",
                href: "/grapher/co-emissions-per-capita",
                type: "chart",
            },
            {
                title: "Energy Data Explorer",
                href: "/explorers/energy",
                type: "explorer",
            },
            {
                title: "Climate Change Impacts Data Explorer",
                href: "/explorers/climate-change",
                type: "explorer",
            },
        ],
    },
    "Food and Agriculture": {
        embed: {
            block: makeBlock("food-trade", "sankey", BlockSize.Wide),
            sourceTitle: "How does food get traded around the world?",
            sourceHref: "/how-does-food-get-traded-around-the-world",
        },
        featured: [
            {
                title: "The world has passed ‘peak agricultural land’",
                href: "/peak-agriculture-land",
                type: "article",
            },
            {
                title: "Global Food Data Explorer",
                href: "/explorers/global-food",
                type: "explorer",
            },
            {
                title: "Daily supply of calories per person",
                href: "/grapher/daily-per-capita-caloric-supply",
                type: "chart",
            },
        ],
    },
    "Poverty and Economic Development": {
        embed: {
            block: makeBlock("income-plots", "distribution", BlockSize.Widest, {
                tab: "global",
                isolateState: "true",
            }),
            sourceTitle: "Visualizing global inequality",
            sourceHref:
                "http://staging-site-staging-server-bespoke/admin/gdocs/1AjxhGRu0vXIdIILbYAGniU0Wu-0lmQTUYMbEWRZaqA8/preview",
            isDraft: true,
        },
        featured: [
            {
                title: "Poverty Data Explorer",
                href: "/explorers/poverty-explorer",
                type: "explorer",
            },
            {
                title: "Share of population living in extreme poverty",
                href: "/grapher/share-of-population-in-extreme-poverty",
                type: "chart",
            },
            {
                title: "GDP per capita",
                href: "/grapher/gdp-per-capita-worldbank",
                type: "chart",
            },
        ],
    },
    "Education and Knowledge": {
        featured: [
            {
                title: "Millions of children learn only very little. How can the world provide a better education to the next generation?",
                href: "/better-learning",
                type: "article",
            },
            {
                title: "Average years of schooling",
                href: "/grapher/mean-years-of-schooling-long-run",
                type: "chart",
            },
            {
                title: "Literate and illiterate world population",
                href: "/grapher/literate-and-illiterate-world-population",
                type: "chart",
            },
        ],
    },
    "Innovation and Technological Change": {
        featured: [
            {
                title: "The brief history of artificial intelligence: the world has changed fast — what might be next?",
                href: "/brief-history-of-ai",
                type: "article",
            },
            {
                title: "Computation used to train notable AI systems",
                href: "/grapher/computation-used-to-train-notable-artificial-intelligence-systems",
                type: "chart",
            },
            {
                title: "Moore’s law: transistors per microprocessor",
                href: "/grapher/transistors-per-microprocessor",
                type: "chart",
            },
        ],
    },
    "Living Conditions, Community and Wellbeing": {
        featured: [
            {
                title: "Self-reported life satisfaction",
                href: "/grapher/happiness-cantril-ladder",
                type: "chart",
            },
            {
                title: "Who Americans spend their time with, by age",
                href: "/grapher/time-spent-with-relationships-by-age-us",
                type: "chart",
            },
            {
                title: "Water, Sanitation and Hygiene Data Explorer",
                href: "/explorers/water-and-sanitation",
                type: "explorer",
            },
        ],
    },
    "Human Rights and Democracy": {
        featured: [
            {
                title: "People around the world have gained democratic rights, but some have many more rights than others",
                href: "/democratic-world",
                type: "article",
            },
            {
                title: "Democracy Data Explorer",
                href: "/explorers/democracy",
                type: "explorer",
            },
            {
                title: "Age of electoral democracy",
                href: "/grapher/age-of-electoral-democracy",
                type: "chart",
            },
        ],
    },
    "Violence and War": {
        featured: [
            {
                title: "War in Ukraine",
                href: "/ukraine-war",
                type: "article",
            },
            {
                title: "Conflict Data Explorer",
                href: "/explorers/conflict-data",
                type: "explorer",
            },
            {
                title: "Deaths in armed conflicts",
                href: "/grapher/deaths-in-armed-conflicts",
                type: "chart",
            },
        ],
    },
}
