import { faSearch, faFilter } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { match } from "ts-pattern"
import { Filter, FilterType } from "./searchTypes"
import { SearchFilterPill } from "./SearchFilterPill.js"
import { getFilterIcon } from "./searchUtils.js"

const MAX_VISIBLE_FILTERS = 3

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
                .with(FilterType.COUNTRY, () => (
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
                .with(FilterType.TOPIC, () => (
                    <>
                        {renderActiveFilters(activeFilters)}
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
    const isCollapsed = filters.length > MAX_VISIBLE_FILTERS
    const visibleFilters = isCollapsed
        ? filters.slice(0, MAX_VISIBLE_FILTERS)
        : filters
    const remainingCount = filters.length - MAX_VISIBLE_FILTERS

    return (
        <>
            {visibleFilters.map((filter) => (
                <SearchFilterPill
                    key={`${filter.type}-${filter.name}`}
                    icon={getFilterIcon(filter)}
                    name={filter.name}
                />
            ))}
            {isCollapsed && (
                <SearchFilterPill
                    key="more-filters"
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
