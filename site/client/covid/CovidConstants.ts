import { SortOrder, NounKey, NounGenerator } from "./CovidTypes"
import { createNoun } from "./CovidUtils"

export const DATA_URL = "https://covid.ourworldindata.org/data/full_data.csv"

// bar colors
export const CURRENT_COLOR = "#1d3d63"
export const HIGHLIGHT_COLOR = "#d42b21"
export const DEFAULT_COLOR = "rgba(0, 33, 71, 0.25)"
export const DEFAULT_FAINT_COLOR = "rgba(0, 33, 71, 0.25)"

export const DEFAULT_SORT_ORDER = SortOrder.asc

export const nouns: Record<NounKey, NounGenerator> = {
    cases: createNoun("case", "cases"),
    deaths: createNoun("death", "deaths"),
    days: createNoun("day", "days")
}
