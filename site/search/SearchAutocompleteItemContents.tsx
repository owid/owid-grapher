import { faSearch, faFilter } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { match } from "ts-pattern"
import { Filter, FilterType } from "./searchTypes"
import { SearchFilterPill } from "./SearchFilterPill.js"
import { getFilterIcon } from "./searchUtils.js"

const MAX_VISIBLE_FILTERS = 3

export function SearchAutocompleteItemContents({
    filter,
    activeFilters = [],
    unmatchedQuery = "",
}: {
    filter: Filter
    activeFilters?: Filter[]
    unmatchedQuery?: string
}) {
    return (
        <div className="search-autocomplete-item-contents">
            <FontAwesomeIcon
                className="search-autocomplete-item-contents__type-icon"
                icon={faSearch}
            />
            {renderActiveFilters(activeFilters)}
            {activeFilters.length > 0 && (
                <span className="search-autocomplete-item-contents__ellipsis">
                    ...
                </span>
            )}
            {match(filter.type)
                // keep in sync with setQueries logic in SearchAutocomplete
                .with(FilterType.QUERY, () => (
                    <>
                        <span className="search-autocomplete-item-contents__query">
                            {filter.name}
                        </span>
                    </>
                ))
                .with(FilterType.COUNTRY, () => (
                    <>
                        <span className="search-autocomplete-item-contents__query">
                            {unmatchedQuery} {filter.name.toLowerCase()}
                        </span>
                    </>
                ))
                .with(FilterType.TOPIC, () => (
                    <>
                        <SearchFilterPill
                            name={filter.name}
                            icon={getFilterIcon(filter)}
                        />
                    </>
                ))
                .exhaustive()}
        </div>
    )
}

const renderActiveFilters = (filters: Filter[]) => {
    const isCollapsed = filters.length > MAX_VISIBLE_FILTERS
    const visibleFilters = isCollapsed
        ? filters.slice(0, MAX_VISIBLE_FILTERS)
        : filters
    const remainingCount = filters.length - MAX_VISIBLE_FILTERS

    return (
        <>
            {visibleFilters.map((filter) => (
                <SearchFilterPill
                    className="search-filter-pill--active"
                    key={`${filter.type}-${filter.name}`}
                    icon={getFilterIcon(filter)}
                    name={filter.name}
                    selected={true}
                />
            ))}
            {isCollapsed && (
                <SearchFilterPill
                    className="search-filter-pill--more-filters"
                    icon={
                        <span className="icon">
                            <FontAwesomeIcon icon={faFilter} />
                        </span>
                    }
                    name={`+ ${remainingCount} more`}
                />
            )}
        </>
    )
}
