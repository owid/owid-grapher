import { RadioButton } from "@ourworldindata/components"
import { SearchResultType } from "@ourworldindata/types"
import { useSearchContext } from "./SearchContext.js"
import { useResultTypeCounts } from "./searchHooks.js"
import {
    getEffectiveResultType,
    hasDatasetFilters,
    isBrowsing,
} from "./searchUtils.js"

const OPTIONS = [
    { value: SearchResultType.ALL, label: "All" },
    { value: SearchResultType.DATA, label: "Data" },
    { value: SearchResultType.WRITING, label: "Writing" },
]

export const SearchResultTypeToggle = () => {
    const {
        state,
        actions: { setResultType },
    } = useSearchContext()
    const { resultType, filters, query } = state
    const { data: counts } = useResultTypeCounts()

    if (hasDatasetFilters(filters)) return null

    const effectiveResultType = getEffectiveResultType(
        filters,
        query,
        resultType
    )

    const optionsToShow = isBrowsing(filters, query)
        ? OPTIONS.filter((option) => option.value !== SearchResultType.ALL)
        : OPTIONS

    const getCount = (value: SearchResultType): number | undefined => {
        if (value === SearchResultType.DATA) return counts?.dataCount
        if (value === SearchResultType.WRITING) return counts?.writingCount
        return undefined
    }

    const getLabel = (option: (typeof OPTIONS)[number]): string => {
        const count = getCount(option.value)
        return count === undefined ? option.label : `${option.label} (${count})`
    }

    return (
        <fieldset
            className="search-result-type-toggle"
            role="radiogroup"
            aria-label="Result type"
        >
            <legend className="search-result-type-toggle__legend">
                Filter by type of content:
            </legend>
            {optionsToShow.map((option) => (
                <RadioButton
                    key={option.value}
                    checked={effectiveResultType === option.value}
                    onChange={() => setResultType(option.value)}
                    label={getLabel(option)}
                    group="search-result-type"
                />
            ))}
        </fieldset>
    )
}
