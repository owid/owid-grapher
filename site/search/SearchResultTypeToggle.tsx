import { RadioButton } from "@ourworldindata/components"
import { SearchResultType } from "@ourworldindata/types"
import { commafyNumber } from "@ourworldindata/utils"
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
    const counts = useResultTypeCounts()

    if (hasDatasetFilters(filters)) return null

    const effectiveResultType = getEffectiveResultType(
        filters,
        query,
        resultType
    )

    const optionsToShow = isBrowsing(filters, query)
        ? OPTIONS.filter((option) => option.value !== SearchResultType.ALL)
        : OPTIONS

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
                const count =
                    option.value !== SearchResultType.ALL
                        ? counts?.[option.value]
                        : undefined
                return (
                    <RadioButton
                        key={option.value}
                        checked={effectiveResultType === option.value}
                        onChange={() => setResultType(option.value)}
                        label={
                            count !== undefined
                                ? `${option.label} (${commafyNumber(count)})`
                                : option.label
                        }
                        group="search-result-type"
                    />
                )
            })}
        </fieldset>
    )
}
