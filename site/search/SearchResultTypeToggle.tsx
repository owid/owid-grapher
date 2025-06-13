import { ResultType } from "./searchTypes.js"
import cx from "classnames"

const OPTIONS = [
    { value: ResultType.ALL, label: "All" },
    { value: ResultType.DATA, label: "Data" },
    { value: ResultType.WRITING, label: "Writing" },
]

export const SearchResultType = ({
    value,
    onChange,
}: {
    value: ResultType
    onChange: (value: ResultType) => void
}) => {
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
                        onChange={() => onChange(option.value)}
                    />
                    <span>{option.label}</span>
                </label>
            ))}
        </fieldset>
    )
}
