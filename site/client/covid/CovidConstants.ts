import { SortOrder, NounKey, NounGenerator } from "./CovidTypes"
import { createNoun } from "./CovidUtils"

export const DATA_URL =
    "https://covid.ourworldindata.org/data/ecdc/full_data.csv"

export const DEFAULT_SORT_ORDER = SortOrder.asc

export const nouns: Record<NounKey, NounGenerator> = {
    cases: createNoun("case", "cases"),
    deaths: createNoun("death", "deaths"),
    days: createNoun("day", "days")
}
