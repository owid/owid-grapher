import { BlockSize, EnrichedBlockBespokeComponent } from "@ourworldindata/types"
import { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import {
    faMagnifyingGlass,
    faRightLeft,
    faArrowPointer,
    faSliders,
    faClockRotateLeft,
    faLocationDot,
    faLayerGroup,
    faCoins,
    faWheatAwn,
    faChartLine,
    faPersonWalkingArrowRight,
} from "@fortawesome/free-solid-svg-icons"

export interface FeaturedVizHighlight {
    icon: IconDefinition
    text: string
}

export interface FeaturedVizItem {
    id: string
    eyebrow: string
    title: string
    description: string
    highlights: FeaturedVizHighlight[]
    authors: string[]
    /** Link to the published article, if there is one */
    articleUrl?: string
    /** For unpublished drafts: where to preview the work in progress */
    draftPreviewUrl?: string
    block: EnrichedBlockBespokeComponent
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

export const FEATURED_VIZ_ITEMS: FeaturedVizItem[] = [
    {
        id: "migration",
        eyebrow: "Migration",
        title: "Where do migrants live, and where were they born?",
        description:
            "Every country's migration story has two sides: the people who moved there, and the people who left. This flow diagram connects where the world's international migrants were born to where they live today, so you can see both sides at once.",
        highlights: [
            {
                icon: faMagnifyingGlass,
                text: "Search for any country to focus the diagram on its migrants",
            },
            {
                icon: faPersonWalkingArrowRight,
                text: "Switch the view between where people moved to and where they were born",
            },
            {
                icon: faArrowPointer,
                text: "Hover over any flow to see how many people it represents",
            },
        ],
        authors: [
            "Hannah Ritchie",
            "Sophia Mersmann",
            "Tuna Acisu",
            "Marwa Boukarim",
        ],
        articleUrl: "/where-do-migrants-live-and-where-were-they-born",
        block: makeBlock("migration", "sankey", BlockSize.Wide, {
            country: "Malaysia",
        }),
    },
    {
        id: "causes-of-death",
        eyebrow: "Global health",
        title: "What do people die from in different countries?",
        description:
            "An interactive treemap of causes of death, where every rectangle is sized by its share of deaths. Compare the whole world with individual countries and income groups, and see how the picture has shifted over more than four decades.",
        highlights: [
            {
                icon: faLayerGroup,
                text: "Switch between the world, regions, income groups, and individual countries",
            },
            {
                icon: faSliders,
                text: "Break the data down by age group and sex",
            },
            {
                icon: faClockRotateLeft,
                text: "Scrub through the decades with the time slider",
            },
            {
                icon: faArrowPointer,
                text: "Hover over any cause to see the number of deaths and its share",
            },
        ],
        authors: ["Hannah Ritchie", "Sophia Mersmann", "Fiona Spooner"],
        articleUrl: "/what-do-people-die-from-in-different-countries",
        block: makeBlock("causes-of-death", "treemap", BlockSize.Wide),
    },
    {
        id: "food-trade",
        eyebrow: "Food & agriculture",
        title: "How does food get traded around the world?",
        description:
            "Much of the food we eat was grown somewhere else. This flow diagram follows food from the countries that export it to the countries that import it — for the world as a whole, for a single product, or for one country's entire food trade.",
        highlights: [
            {
                icon: faWheatAwn,
                text: "Pick a product — soybeans, coffee, wheat — and see who exports and imports it",
            },
            {
                icon: faRightLeft,
                text: "Focus on one country and flip between its exports and its imports",
            },
            {
                icon: faArrowPointer,
                text: "Hover over a flow to see how much food it carries",
            },
        ],
        authors: [
            "Hannah Ritchie",
            "Sophia Mersmann",
            "Pablo Rosado",
            "Marwa Boukarim",
        ],
        articleUrl: "/how-does-food-get-traded-around-the-world",
        block: makeBlock("food-trade", "sankey", BlockSize.Wide),
    },
    {
        id: "population-simulation",
        eyebrow: "Population & demography",
        title: "How will populations change in the 21st century?",
        description:
            "A population simulator built on the same approach as the UN's projections. Set the fertility rate, life expectancy, and migration yourself, and watch how a country's population — and its age structure — responds over the rest of the century.",
        highlights: [
            {
                icon: faLocationDot,
                text: "Starts with the country you're in — or pick any other",
            },
            {
                icon: faSliders,
                text: "Drag the fertility, life expectancy, and migration sliders to build your own scenario",
            },
            {
                icon: faChartLine,
                text: "Compare your scenario against the UN's projections as it unfolds",
            },
        ],
        authors: ["Sophia Mersmann", "Daniel Bachler", "Hannah Ritchie"],
        articleUrl: "/population-simulation-tool",
        block: makeBlock("demography", "simulation", BlockSize.Widest, {
            region: "userLocation",
        }),
    },
    {
        id: "global-inequality",
        eyebrow: "Economic inequality",
        title: "Visualizing global inequality",
        description:
            "Every country's income distribution, stacked into one global picture based on the World Bank's global income data. It makes visible the large inequalities that exist both within and between countries — at the same time.",
        highlights: [
            {
                icon: faLayerGroup,
                text: "Switch between the global picture and country-by-country comparisons",
            },
            {
                icon: faMagnifyingGlass,
                text: "Add your own country and see how its income distribution compares",
            },
            {
                icon: faArrowPointer,
                text: "Click anywhere in the plot to see the share of people below that income",
            },
            {
                icon: faCoins,
                text: "View incomes in international dollars or your local currency",
            },
        ],
        authors: [
            "Joe Hasell",
            "Marcel Gerber",
            "Pablo Arriagada",
            "Bertha Rohenkohl",
            "Marwa Boukarim",
        ],
        draftPreviewUrl:
            "http://staging-site-staging-server-bespoke/admin/gdocs/1AjxhGRu0vXIdIILbYAGniU0Wu-0lmQTUYMbEWRZaqA8/preview",
        block: makeBlock("income-plots", "distribution", BlockSize.Widest, {
            tab: "global",
            isolateState: "true",
        }),
    },
]
