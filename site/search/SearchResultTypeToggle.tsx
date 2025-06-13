import { ResultType } from "./searchTypes.js"
import cx from "classnames"
import { useSearchContext } from "./SearchContext.js"

const OPTIONS = [
    { value: ResultType.ALL, label: "All" },
    { value: ResultType.DATA, label: "Data" },
    { value: ResultType.WRITING, label: "Writing" },
]

export const SearchResultType = () => {
    const {
        state,
        actions: { setResultType },
    } = useSearchContext()
    const { resultType: value } = state
    return (
        <fieldset
            className="search-result-type-toggle"
            role="radiogroup"
            aria-label="Result type"
        >
            {OPTIONS.map((option) => (
                <label key={option.value}>
                    <input
                        type="radio"
                        name="search-result-type"
                        className={cx("search-result-type-toggle__button", {
                            "search-result-type-toggle__button--selected":
                                value === option.value,
                        })}
                        value={option.value}
                        checked={value === option.value}
                        onChange={() => setResultType(option.value)}
                    />
                    <span>{option.label}</span>
                </label>
            ))}
        </fieldset>
    )
}
