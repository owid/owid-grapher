import { FilterType } from "./searchTypes.js"
import { getCountryData, getFilterNamesOfType } from "./searchUtils.js"
import { useSearchContext } from "./SearchContext.js"
import { Region } from "@ourworldindata/utils"

export const useSelectedCountries = (): Region[] => {
    const selectedCountryNames = useSelectedCountryNames()
    return getCountryData(selectedCountryNames)
}

export const useSelectedTopic = (): string | undefined => {
    const { state } = useSearchContext()
    const selectedTopics = getFilterNamesOfType(state.filters, FilterType.TOPIC)
    return selectedTopics.size > 0 ? [...selectedTopics][0] : undefined
}

export const useSelectedCountryNames = (): Set<string> => {
    const { state } = useSearchContext()
    return getFilterNamesOfType(state.filters, FilterType.COUNTRY)
}
