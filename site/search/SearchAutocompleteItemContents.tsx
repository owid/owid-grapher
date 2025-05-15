import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { match } from "ts-pattern"
import { Filter, FilterType } from "./searchTypes"
import { SearchFilterPill } from "./SearchFilterPill.js"
import { getFilterIcon } from "./searchUtils.js"

export function SearchAutocompleteItemContents({
    filter,
    baseQuery,
    activeFilters = [],
}: {
    filter: Filter
    baseQuery?: string
    activeFilters?: Filter[]
}) {
    return (
        <span className="search-autocomplete-item-contents">
            {match(filter.type)
                .with(FilterType.QUERY, () => (
                    <>
                        <FontAwesomeIcon
                            className="search-autocomplete-item-contents__search-icon"
                            icon={faSearch}
                        />
                        {renderActiveFilters(activeFilters)}
                        <span className="search-autocomplete-item-contents__query">
                            {filter.name}
                        </span>
                    </>
                ))
                .with(FilterType.COUNTRY, FilterType.TOPIC, () => (
                    <>
                        {renderActiveFilters(activeFilters)}
                        {baseQuery && (
                            <span className="search-autocomplete-item-contents__query">
                                {baseQuery}
                            </span>
                        )}
                        <SearchFilterPill
                            name={filter.name}
                            icon={getFilterIcon(filter)}
                        />
                    </>
                ))
                .exhaustive()}
        </span>
    )
}

const renderActiveFilters = (filters: Filter[]) => {
    return filters.map((filter) => (
        <SearchFilterPill
            key={`${filter.type}-${filter.name}`}
            name={filter.name}
            icon={getFilterIcon(filter)}
        />
    ))
}
