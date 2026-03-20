import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export const SearchNoResults = () => {
    return (
        <div className="search-no-results span-cols-12 col-start-2">
            <FontAwesomeIcon
                className="search-no-results__icon"
                icon={faSearch}
            />
            <h2 className="body-1-regular">No results found for this query.</h2>
            <p className="body-3-medium">
                Try exploring a suggested topic above, or search for something
                else.
            </p>
        </div>
    )
}
