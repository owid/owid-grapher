import { RelatedChart } from "@ourworldindata/types"

/**
 * Data perspectives — prototype fixtures.
 *
 * A "data perspective" (a.k.a. "data nugget") is one alternative view of the
 * page's own chart: a grapher query string, optionally carrying a title and a
 * sentence or two of prose.
 *
 * The single schema is deliberate. The Prague group's open question was whether
 * these are "nuggets" (title + text, hand-written) or "perspectives" (a view of
 * the data, templated). Modelling them as one item type with optional fields
 * means an array can mix both, and "how templated is it?" becomes a property of
 * the item rather than a fork in the component.
 */

export type DataPerspectiveKind =
    /** Generatable from the data alone (top N, biggest movers, latest map). */
    | "templated"
    /** Written by a human because the point isn't derivable from the numbers. */
    | "authored"

export interface DataPerspective {
    /**
     * Grapher query string, without the leading "?".
     *
     * Always include an explicit `tab`. Without one a perspective inherits the
     * chart's default tab, which differs between charts — life-expectancy
     * defaults to the map, so a "since 1770" line-chart perspective would
     * render as a 1770-vs-2023 comparison map.
     */
    queryParams: string
    /** Optional — some perspectives are a thumbnail and nothing else. */
    title?: string
    /** Optional supporting prose. Lengths vary on purpose, to test density. */
    text?: string
    kind: DataPerspectiveKind
}

export const DATA_PERSPECTIVES: Record<string, DataPerspective[]> = {
    "child-mortality": [
        {
            // From the Prague board's worked example.
            queryParams:
                "tab=line&time=1974..latest&country=OWID_AFR~OWID_EUR~OWID_ASI~OWID_NAM~OWID_SAM~OWID_OCE",
            title: "Child mortality has fallen on every continent",
            text: "Since 1974 the share of children who die before their fifth birthday has fallen on every continent — including in Africa, where it more than halved.",
            kind: "authored",
        },
        {
            // Also from the board.
            queryParams: "tab=line&country=~SWE",
            title: "Sweden: from 35% to 0.2%",
            text: "Sweden's records reach back to the 1750s, when more than a third of children died before age five.",
            kind: "authored",
        },
        {
            queryParams: "tab=map&time=latest",
            title: "Where child deaths are most common today",
            kind: "templated",
        },
        {
            queryParams: "tab=discrete-bar&time=latest",
            title: "The countries with the highest rates",
            text: "Ranked, most recent year.",
            kind: "templated",
        },
        {
            queryParams: "tab=line&country=NER~SWE&time=1900..latest",
            title: "Today's worst rate beats the best of 1900",
            text: "Niger's child mortality today is lower than Sweden's was in 1900 — a reminder both of how far the world has come, and how unevenly.",
            kind: "authored",
        },
    ],
    "life-expectancy": [
        {
            queryParams: "tab=map&time=latest",
            title: "Life expectancy around the world today",
            kind: "templated",
        },
        {
            queryParams: "tab=line&country=~OWID_WRL&time=1770..latest",
            title: "The world has more than doubled its life expectancy",
            text: "In 1900 the global average was around 32 years. It is now over 70.",
            kind: "authored",
        },
        {
            queryParams: "tab=line&country=~RUS&time=1985..2005",
            title: "Russia's post-Soviet collapse",
            text: "Male life expectancy fell by more than six years in the decade after 1991 — one of the sharpest peacetime reversals ever recorded.",
            kind: "authored",
        },
        {
            queryParams:
                "tab=line&country=JPN~USA~GBR~IND~NGA&time=1950..latest",
            title: "Five countries since 1950",
            kind: "templated",
        },
        {
            queryParams: "tab=discrete-bar&time=latest",
            kind: "templated",
        },
    ],
}

/**
 * Related data pages for the explorer's `dpAxes=pages` mode, tried before the
 * page's own coview-based related charts.
 *
 * Two reasons: coview data isn't in the local dev database (so that list is
 * empty in development), and a related page without perspectives would land
 * you in an empty explorer. Pointing the fixture pages at each other keeps the
 * whole loop explorable.
 */
export const RELATED_DATA_PAGES: Record<
    string,
    { slug: string; title: string }[]
> = {
    "child-mortality": [{ slug: "life-expectancy", title: "Life expectancy" }],
    "life-expectancy": [
        { slug: "child-mortality", title: "Child mortality rate" },
    ],
}

/**
 * The live site's coview-based related charts for the prototype pages,
 * snapshotted from ourworldindata.org on 2026-09-23.
 *
 * Coview data comes from analytics, not the metadata dump, so the local dev
 * database has none and the page's "Related charts" component never renders.
 * These stand in only when the page's own list is empty.
 */
export const RELATED_CHARTS_FALLBACK: Record<string, RelatedChart[]> = {
    "child-mortality": [
        {
            chartId: 64,
            slug: "life-expectancy",
            title: "Life expectancy",
            variantName: "over the long-run",
        },
        {
            chartId: 226,
            slug: "children-born-per-woman",
            title: "Fertility rate: births per woman",
            variantName: "Long-run",
        },
        {
            chartId: 2617,
            slug: "cross-country-literacy-rates",
            title: "Literacy rate",
            variantName: null,
        },
        {
            chartId: 1471,
            slug: "annual-number-of-deaths-by-cause",
            title: "Causes of death",
            variantName: "IHME",
        },
        {
            chartId: 5111,
            slug: "share-of-population-in-extreme-poverty",
            title: "Share of population living in extreme poverty",
            variantName: null,
        },
        {
            chartId: 194,
            slug: "population-growth-rates",
            title: "Population growth rate",
            variantName: "1950-2100, with UN projections",
        },
    ],
    "life-expectancy": [
        {
            chartId: 2562,
            slug: "child-mortality",
            title: "Child mortality rate",
            variantName: "Long-run data \u2013 Gapminder; UN IGME",
        },
        {
            chartId: 390,
            slug: "population-with-un-projections",
            title: "Population",
            variantName: "1950-2100, with UN projections",
        },
        {
            chartId: 2617,
            slug: "cross-country-literacy-rates",
            title: "Literacy rate",
            variantName: null,
        },
        {
            chartId: 226,
            slug: "children-born-per-woman",
            title: "Fertility rate: births per woman",
            variantName: "Long-run",
        },
        {
            chartId: 5111,
            slug: "share-of-population-in-extreme-poverty",
            title: "Share of population living in extreme poverty",
            variantName: null,
        },
        {
            chartId: 4659,
            slug: "gdp-per-capita-maddison-project-database",
            title: "GDP per capita",
            variantName:
                "Long-run data in constant international-$ - Maddison Project Database",
        },
    ],
}

export function getDataPerspectives(
    slug: string | undefined
): DataPerspective[] {
    if (!slug) return []
    return DATA_PERSPECTIVES[slug] ?? []
}
