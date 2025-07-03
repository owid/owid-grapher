import { SearchResultType } from "./searchTypes.js"
import cx from "classnames"
import { useSearchContext } from "./SearchContext.js"
import { getEffectiveResultType, isBrowsing } from "./searchUtils.js"

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
            {optionsToShow.map((option) => (
                <label key={option.value}>
                    <input
                        type="radio"
                        name="search-result-type"
                        className={cx("search-result-type-toggle__button", {
                            "search-result-type-toggle__button--selected":
                                effectiveResultType === option.value,
                        })}
                        value={option.value}
                        checked={effectiveResultType === option.value}
                        onChange={() => setResultType(option.value)}
                    />
                    <span>{option.label}</span>
                </label>
            ))}
        </fieldset>
    )
}
