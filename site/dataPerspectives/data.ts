import { type GrapherQueryParams } from "@ourworldindata/types"

export interface Perspective {
    id: string
    title: string
    config: Pick<GrapherQueryParams, "tab" | "time" | "country" | "mapSelect">
}

export interface DataPage {
    slug: string
    /** Title of the default (unmodified chart) perspective; defaults to "Base view" */
    defaultPerspectiveTitle?: string
    perspectives: Perspective[]
    relatedData?: {
        topic: string
        topicLabel: string
        items: { slug: string; title: string }[]
    }
    relatedArticles?: {
        topic: string
        topicLabel: string
        items: { slug: string; title: string; imageId: string }[]
    }
}

export const pages: DataPage[] = [
    {
        slug: "child-mortality",
        defaultPerspectiveTitle: "Chart mortality over time",
        relatedArticles: {
            topic: "Child & Infant Mortality",
            topicLabel: "child mortality",
            items: [
                {
                    title: "Child mortality: an everyday tragedy of enormous scale that we can make progress against",
                    slug: "child-mortality-big-problem-in-brief",
                    imageId: "d521a543-39f4-453d-6717-3a95c46a8e00",
                },
                {
                    title: "Five million children die every year — what do they die from?",
                    slug: "five-million-children-die-every-year-what-do-they-die-from",
                    imageId: "b8650845-1cae-4503-540d-d1c6681b4900",
                },
                {
                    title: "Mortality in the past: every second child died",
                    slug: "child-mortality-in-the-past",
                    imageId: "6fd6ae68-a5d6-4e22-990e-183793e8b800",
                },
                {
                    title: "How often did parents see their children die?",
                    slug: "parents-losing-their-child",
                    imageId: "b68693d6-9917-4b8a-6db9-41ef0dcda700",
                },
                {
                    title: "How child mortality has declined in the last two centuries",
                    slug: "child-mortality-global-overview",
                    imageId: "710cc948-e700-4ad7-3fce-a719775f1800",
                },
                {
                    title: "Half of all child deaths are linked to malnutrition",
                    slug: "half-child-deaths-linked-malnutrition",
                    imageId: "f2a5a513-8639-4f2b-21cf-9bbf54057400",
                },
            ],
        },
        relatedData: {
            topic: "Child & Infant Mortality",
            topicLabel: "child mortality",
            items: [
                {
                    title: "What do children die of?",
                    slug: "causes-of-death-in-children-under-5",
                },
                {
                    title: "How many children die every year?",
                    slug: "child-deaths-igme-data",
                },
                {
                    title: "How many babies die in the first month of their lives?",
                    slug: "neonatal-mortality-wdi",
                },
            ],
        },
        perspectives: [
            {
                id: "continents",
                title: "How child mortality declined on every continent",
                config: {
                    time: "1974..latest",
                    country:
                        "OWID_AFR~OWID_EUR~OWID_ASI~OWID_NAM~OWID_SAM~OWID_OCE",
                },
            },
            {
                id: "long-view",
                title: "Child mortality in Sweden over the last 270 years",
                config: { country: "~SWE" },
            },
            {
                id: "latest-map",
                title: "The latest data on child mortality around the world",
                config: { tab: "map" },
            },
            {
                id: "rwanda",
                title: "How child mortality peaked during the Rwandan genocide",
                config: { country: "~RWA", mapSelect: "~RWA" },
            },
        ],
    },
    {
        slug: "share-of-population-in-extreme-poverty",
        perspectives: [
            {
                id: "global-progress",
                title: "Extreme poverty has fallen substantially worldwide",
                config: {
                    tab: "chart",
                    time: "1990..2024",
                    country: "~OWID_WRL",
                },
            },
            {
                id: "china",
                title: "China’s decline in extreme poverty has been dramatic",
                config: { tab: "chart", time: "1990..2022", country: "~CHN" },
            },
            {
                id: "uneven-progress",
                title: "Extreme poverty remains common in many countries",
                config: { tab: "map", time: "latest" },
            },
        ],
    },
    {
        slug: "prevalence-of-undernourishment",
        perspectives: [
            {
                id: "global-setback",
                title: "Progress against hunger has suffered a setback",
                config: {
                    tab: "chart",
                    time: "2001..2024",
                    country: "~OWID_WRL",
                },
            },
            {
                id: "regional-paths",
                title: "Regions are moving in different directions",
                config: {
                    tab: "chart",
                    time: "2015..2024",
                    country: "Sub-Saharan Africa (FAO)~Southern Asia (FAO)",
                },
            },
            {
                id: "hunger-map",
                title: "Where is undernourishment most widespread?",
                config: { tab: "map", time: "2023" },
            },
        ],
    },
]

// One configuration powers both the thumbnail and the interactive chart.
// `imBare` is only supported by the image functions on this branch, so the
// dev-only prototype renders thumbnails with the local Cloudflare functions.
const THUMBNAIL_BASE_URL = "http://localhost:8788/grapher"

export function chartUrl(
    page: Pick<DataPage, "slug">,
    perspective?: Perspective,
    thumbnail = false
): string {
    const url = new URL(
        thumbnail
            ? `${THUMBNAIL_BASE_URL}/${page.slug}.png`
            : `https://ourworldindata.org/grapher/${page.slug}`
    )
    if (perspective) {
        for (const [key, value] of Object.entries(perspective.config)) {
            url.searchParams.set(key, value)
        }
    }
    if (thumbnail) {
        url.searchParams.set("imType", "thumbnail")
        url.searchParams.set("imMinimal", "1")
        url.searchParams.set("imBare", "1")
    }
    return url.toString()
}
