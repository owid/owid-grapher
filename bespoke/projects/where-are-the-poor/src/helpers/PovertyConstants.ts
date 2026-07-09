import { EntityName, Time } from "@ourworldindata/types"
import { ContinentColors } from "@ourworldindata/grapher/src/color/CustomSchemes.js"

export interface PovertyLine {
    cents: number
    label: string
    /** Definition sentence shown in the subtitle, matching the wording of
     * the poverty_pip MDim and the world_bank_pip grapher configs */
    definition?: string
}

// The individual poverty lines from the poverty_pip MDim (2021 PPP prices)
export const POVERTY_LINES: PovertyLine[] = [
    { cents: 100, label: "$1 a day" },
    {
        cents: 300,
        label: "$3 a day",
        definition:
            "Extreme poverty is defined as living below the International Poverty Line of $3 per day.",
    },
    {
        cents: 420,
        label: "$4.20 a day",
        definition:
            "The poverty line of $4.20 per day is set by the World Bank to be representative of the definitions of poverty adopted in lower-middle-income countries.",
    },
    {
        cents: 830,
        label: "$8.30 a day",
        definition:
            "The poverty line of $8.30 per day is set by the World Bank to be representative of the definitions of poverty adopted in upper-middle-income countries.",
    },
    { cents: 1000, label: "$10 a day" },
    { cents: 2000, label: "$20 a day" },
    { cents: 3000, label: "$30 a day" },
    { cents: 4000, label: "$40 a day" },
]

// The International Poverty Line, used to measure extreme poverty
export const EXTREME_POVERTY_LINE_CENTS = 300

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

// Regions that can be selected to filter the treemap, depending on the
// active grouping
const CONTINENT_SELECTION_OPTIONS: string[] = [
    WORLD_SELECTION,
    "Africa",
    "Asia",
    "Europe",
    "North America",
    "Oceania",
    "South America",
]

const WB_REGION_SELECTION_OPTIONS: string[] = [
    WORLD_SELECTION,
    "East Asia and Pacific (WB)",
    "Europe and Central Asia (WB)",
    "Latin America and Caribbean (WB)",
    "Middle East, North Africa, Afghanistan and Pakistan (WB)",
    "North America (WB)",
    "South Asia (WB)",
    "Sub-Saharan Africa (WB)",
]

export const getRegionSelectionOptions = (groupBy: GroupBy): string[] =>
    groupBy === "continent"
        ? CONTINENT_SELECTION_OPTIONS
        : WB_REGION_SELECTION_OPTIONS

export const DEFAULT_REGION = WORLD_SELECTION

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
    region?: string
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
