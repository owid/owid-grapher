import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons"

export const SearchResetButton = ({
    disabled,
    onReset,
}: {
    disabled: boolean
    onReset: () => void
}) => {
    return (
        <button
            className="search-reset-button"
            disabled={disabled}
            aria-label="Clear search query and all filters"
            type="button"
            onClick={onReset}
        >
            <FontAwesomeIcon icon={faTimesCircle} />
        </button>
    )
}
