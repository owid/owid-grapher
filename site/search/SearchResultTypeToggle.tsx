import { RadioButton } from "@ourworldindata/components"
import { commafyNumber } from "@ourworldindata/utils"
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

    const { dataCount, writingCount, isLoading } = useResultTypeCounts()

    if (hasDatasetFilters(filters)) return null

    const effectiveResultType = getEffectiveResultType(
        filters,
        query,
        resultType
    )

    const optionsToShow = isBrowsing(filters, query)
        ? OPTIONS.filter((option) => option.value !== SearchResultType.ALL)
        : OPTIONS

    const countForOption = (value: SearchResultType): number | undefined => {
        if (dataCount === undefined || writingCount === undefined)
            return undefined
        switch (value) {
            case SearchResultType.DATA:
                return dataCount
            case SearchResultType.WRITING:
                return writingCount
            case SearchResultType.ALL:
                return dataCount + writingCount
        }
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
            {optionsToShow.map((option) => {
                const count = countForOption(option.value)
                const label =
                    isLoading || count === undefined
                        ? option.label
                        : `${option.label} (${commafyNumber(count)})`
                return (
                    <RadioButton
                        key={option.value}
                        checked={effectiveResultType === option.value}
                        onChange={() => setResultType(option.value)}
                        label={label}
                        group="search-result-type"
                    />
                )
            })}
        </fieldset>
    )
}
