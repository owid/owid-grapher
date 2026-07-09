import { EntityName, Time } from "@ourworldindata/types"
import { ContinentColors } from "@ourworldindata/grapher/src/color/CustomSchemes.js"

export interface PovertyLine {
    cents: number
    label: string
    description?: string
}

// The individual poverty lines from the poverty_pip MDim (2021 PPP prices)
export const POVERTY_LINES: PovertyLine[] = [
    { cents: 100, label: "$1 a day" },
    {
        cents: 300,
        label: "$3 a day",
        description:
            "The International Poverty Line set by the World Bank to measure extreme poverty",
    },
    {
        cents: 420,
        label: "$4.20 a day",
        description:
            "Set by the World Bank to reflect national definitions in lower-middle income countries",
    },
    {
        cents: 830,
        label: "$8.30 a day",
        description:
            "Set by the World Bank to reflect national definitions in upper-middle income countries",
    },
    { cents: 1000, label: "$10 a day" },
    { cents: 2000, label: "$20 a day" },
    { cents: 3000, label: "$30 a day" },
    { cents: 4000, label: "$40 a day" },
]

export const DEFAULT_POVERTY_LINE_CENTS = 300

// The most recent year that is not a pure forward projection
export const DEFAULT_YEAR = 2025

export type GroupBy = "continent" | "wbRegion"

export const DEFAULT_GROUP_BY: GroupBy = "continent"

export const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
    { value: "continent", label: "Continent" },
    { value: "wbRegion", label: "World Bank region" },
]

export const WORLD_SELECTION = "World"

// Continents that can be selected to filter the treemap
export const CONTINENT_OPTIONS: string[] = [
    WORLD_SELECTION,
    "Africa",
    "Asia",
    "Europe",
    "North America",
    "Oceania",
    "South America",
]

export const DEFAULT_CONTINENT = WORLD_SELECTION

/** Schema of the committed src/data/headcounts-{cents}.json files */
export interface HeadcountFileJson {
    povertyLineCents: number
    years: number[]
    countries: string[]
    values: (number | null)[][]
}

export interface DataRow {
    countryName: EntityName
    continent: string
    wbRegion: string
    year: Time
    headcount: number
}

export interface EnrichedDataItem {
    id: string
    parentId?: string
    countryName?: EntityName
    group?: string
    value?: number
    share?: number
}

export type TreeNode = d3.HierarchyRectangularNode<
    d3.HierarchyNode<EnrichedDataItem>
>

export interface TooltipState {
    target: { node: TreeNode } | null
    position: { x: number; y: number }
}

export interface WhereAreThePoorConfig {
    povertyLine?: number
    year?: number
    groupBy?: GroupBy
    continent?: string
    hideControls?: boolean
}

// ContinentColors also contains entries for the World Bank regions, whose
// names match the PIP naming exactly, so it covers both groupings.
export const getGroupColor = (group?: string): string => {
    if (!group) return "#cccccc"
    return (ContinentColors as Record<string, string>)[group] ?? "#cccccc"
}

/** Display label for a group: strips the " (WB)" suffix from WB region names */
export const formatGroupLabel = (group: string): string =>
    group.replace(/ \(WB\)$/, "")
