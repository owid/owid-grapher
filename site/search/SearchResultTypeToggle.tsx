import { commafyNumber } from "@ourworldindata/utils"
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

    const showToggle = !hasDatasetFilters(filters)
    const { data: counts } = useResultTypeCounts({ enabled: showToggle })

    if (!showToggle) return null

    const effectiveResultType = getEffectiveResultType(
        filters,
        query,
        resultType
    )

    const optionsToShow = isBrowsing(filters, query)
        ? OPTIONS.filter((option) => option.value !== SearchResultType.ALL)
        : OPTIONS

    const countForOption = (value: SearchResultType): number | undefined => {
        if (!counts) return undefined
        if (value === SearchResultType.DATA) return counts.dataCount
        if (value === SearchResultType.WRITING) return counts.writingCount
        return undefined
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
                return (
                    <RadioButton
                        key={option.value}
                        checked={effectiveResultType === option.value}
                        onChange={() => setResultType(option.value)}
                        label={
                            count === undefined ? (
                                option.label
                            ) : (
                                <>
                                    {option.label}{" "}
                                    <span className="search-result-type-toggle__count">
                                        ({commafyNumber(count)})
                                    </span>
                                </>
                            )
                        }
                        group="search-result-type"
                    />
                )
            })}
        </fieldset>
    )
}
