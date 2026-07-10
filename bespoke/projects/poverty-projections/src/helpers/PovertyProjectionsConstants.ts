import {
    ContinentColors,
    OwidDistinctColors,
} from "@ourworldindata/grapher/src/color/CustomSchemes.js"

export type VariantName = "share" | "stacked-area"

export interface PovertyLine {
    cents: number
    label: string
    /** Definition sentence shown in the subtitle, matching the wording of
     * the poverty_pip MDim and the world_bank_pip grapher configs */
    definition: string
}

// The poverty lines published in the PIP Poverty Projections dataset
// (2021 PPP prices)
export const POVERTY_LINES: PovertyLine[] = [
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
]

// The International Poverty Line, used to measure extreme poverty
export const EXTREME_POVERTY_LINE_CENTS = 300

export const DEFAULT_POVERTY_LINE_CENTS = 300

export type ScenarioId =
    | "growth2pct"
    | "growth4pct"
    | "growth6pct"
    | "growth8pct"
    | "growth2pctGini1"
    | "growth2pctGini2"

/** The baseline projection published in the historical+projected files,
 * based on the World Bank's and IMF's current growth forecasts */
export const BASELINE_SCENARIO = "baseline"

/** Show the baseline and all alternative scenarios as a fan (World only) */
export const ALL_SCENARIOS = "all"

/** Selection in the scenario dropdown: the baseline projection, a single
 * alternative scenario, or the all-scenarios fan */
export type ScenarioSelection =
    | ScenarioId
    | typeof BASELINE_SCENARIO
    | typeof ALL_SCENARIOS

export const BASELINE_LABEL = "Current forecasts"

export interface Scenario {
    id: ScenarioId
    label: string
    /** The scenario's assumption, spelled out in the chart subtitle */
    assumption: string
}

// Must match the scenario order written by dataPrep/prepareData.py
export const SCENARIOS: Scenario[] = [
    {
        id: "growth2pct",
        label: "2% growth",
        assumption:
            "incomes in every country grow at a constant rate of 2% per year, with no change in inequality",
    },
    {
        id: "growth4pct",
        label: "4% growth",
        assumption:
            "incomes in every country grow at a constant rate of 4% per year, with no change in inequality",
    },
    {
        id: "growth6pct",
        label: "6% growth",
        assumption:
            "incomes in every country grow at a constant rate of 6% per year, with no change in inequality",
    },
    {
        id: "growth8pct",
        label: "8% growth",
        assumption:
            "incomes in every country grow at a constant rate of 8% per year, with no change in inequality",
    },
    {
        id: "growth2pctGini1",
        label: "2% growth + 1% Gini reduction",
        assumption:
            "incomes in every country grow at a constant rate of 2% per year, while inequality — as measured by the Gini coefficient — falls by 1% each year",
    },
    {
        id: "growth2pctGini2",
        label: "2% growth + 2% Gini reduction",
        assumption:
            "incomes in every country grow at a constant rate of 2% per year, while inequality — as measured by the Gini coefficient — falls by 2% each year",
    },
]

export const getScenarioLabel = (scenario: ScenarioSelection): string =>
    scenario === BASELINE_SCENARIO
        ? BASELINE_LABEL
        : scenario === ALL_SCENARIOS
          ? "All scenarios"
          : (SCENARIOS.find((s) => s.id === scenario)?.label ?? scenario)

export const WORLD = "World"

// The seven World Bank regions, named as in the OWID ETL
// (garden/wb/2026-03-25/poverty_projections.countries.json)
export const WB_REGIONS: string[] = [
    "East Asia and Pacific (WB)",
    "Europe and Central Asia (WB)",
    "Latin America and Caribbean (WB)",
    "Middle East, North Africa, Afghanistan and Pakistan (WB)",
    "North America (WB)",
    "South Asia (WB)",
    "Sub-Saharan Africa (WB)",
]

export const ENTITIES: string[] = [WORLD, ...WB_REGIONS]

/** Stacking order of the regions, bottom to top — mirrors the entity order
 * of the published chart ourworldindata.org/grapher/projections-extreme-poverty-wb */
export const REGION_STACK_ORDER: string[] = [
    "North America (WB)",
    "Europe and Central Asia (WB)",
    "Latin America and Caribbean (WB)",
    "Middle East, North Africa, Afghanistan and Pakistan (WB)",
    "Sub-Saharan Africa (WB)",
    "East Asia and Pacific (WB)",
    "South Asia (WB)",
]

/** Display label for an entity: strips the " (WB)" suffix from region names */
export const formatEntityLabel = (entity: string): string =>
    entity.replace(/ \(WB\)$/, "")

// ContinentColors contains entries for the World Bank regions, whose names
// match the ETL naming exactly. The World gets a darker blue so it stands
// apart from the Europe and Central Asia line (Denim).
export const getEntityColor = (entity: string): string => {
    if (entity === WORLD) return OwidDistinctColors.MidnightBlue
    return (ContinentColors as Record<string, string>)[entity] ?? "#cccccc"
}

/** Colors for the all-scenarios fan: growth scenarios go from warm
 * (pessimistic) to green (optimistic); the Gini-reduction variants use the
 * purple family; the baseline matches the World line color. */
export const SCENARIO_COLORS: Record<ScenarioId, string> = {
    growth2pct: OwidDistinctColors.DustyCoral,
    growth4pct: OwidDistinctColors.Copper,
    growth6pct: OwidDistinctColors.OliveGreen,
    growth8pct: OwidDistinctColors.TealishGreen,
    growth2pctGini1: OwidDistinctColors.Mauve,
    growth2pctGini2: OwidDistinctColors.Purple,
}

/** Dotted stroke used for projected segments, matching grapher's
 * projected-data line style */
export const PROJECTION_DASHARRAY = "2,3"

/** Style of the projection marker (vertical line + shading), mirroring
 * grapher's ComparisonLine style */
export const MARKER_LINE_COLOR = "#cccccc"
export const MARKER_LABEL_COLOR = "#999999"
export const MARKER_SHADING_COLOR = "rgba(0, 0, 0, 0.03)"

/** Below this chart width, right-edge line labels are replaced by a legend */
export const SMALL_CHART_BREAKPOINT = 620

export interface ProjectionsScenarioJson {
    id: ScenarioId
    headcountRatio: number[][]
    poorPop: number[][]
}

/** Schema of the committed src/data/projections-{cents}.json files */
export interface ProjectionsFileJson {
    povertyLineCents: number
    /** "World" first, then the seven WB regions */
    entities: string[]
    /** Contiguous, 1990-2050 */
    years: number[]
    /** Years >= this are projections (dotted lines / shaded area) */
    firstProjectionYear: number
    /** [entityIndex][yearIndex], in % */
    headcountRatio: number[][]
    /** [entityIndex][yearIndex], in people */
    poorPop: number[][]
    /** Contiguous, firstProjectionYear-2050 */
    scenarioYears: number[]
    scenarios: ProjectionsScenarioJson[]
}

export interface PovertyProjectionsConfig {
    povertyLine?: number
    scenario?: ScenarioSelection
    hideControls?: boolean
}
