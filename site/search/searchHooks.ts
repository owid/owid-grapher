import { FilterType } from "./searchTypes.js"
import {
    getCountryData,
    getFilterNamesOfType,
    getSelectedTopic,
} from "./searchUtils.js"
import { useSearchContext } from "./SearchContext.js"
import { Region } from "@ourworldindata/utils"

export const useSelectedCountries = (): Region[] => {
    const selectedCountryNames = useSelectedCountryNames()
    return getCountryData(selectedCountryNames)
}

export const useSelectedTopic = (): string | undefined => {
    const { state } = useSearchContext()
    return getSelectedTopic(state.filters)
}

export const useSelectedCountryNames = (): Set<string> => {
    const { state } = useSearchContext()
    return getFilterNamesOfType(state.filters, FilterType.COUNTRY)
}
