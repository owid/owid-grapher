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

export const SearchResultTypeToggle = () => {
    const {
        state,
        actions: { setResultType },
    } = useSearchContext()
    const { resultType, filters, query } = state
    const { allCount, dataCount, writingCount } = useResultTypeCounts()

    if (hasDatasetFilters(filters)) return null

    const effectiveResultType = getEffectiveResultType(
        filters,
        query,
        resultType
    )

    const options = [
        { value: SearchResultType.ALL, label: "All", count: allCount },
        { value: SearchResultType.DATA, label: "Data", count: dataCount },
        {
            value: SearchResultType.WRITING,
            label: "Writing",
            count: writingCount,
        },
    ]

    const optionsToShow = isBrowsing(filters, query)
        ? options.filter((option) => option.value !== SearchResultType.ALL)
        : options

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
                    label={
                        <>
                            {option.label}
                            {option.count !== undefined && (
                                <span className="search-result-type-toggle__count">
                                    {" "}
                                    ({commafyNumber(option.count)})
                                </span>
                            )}
                        </>
                    }
                    group="search-result-type"
                />
            ))}
        </fieldset>
    )
}
