import { match } from "ts-pattern"
import { FilterType } from "@ourworldindata/types"
import { SearchFilterPill } from "./SearchFilterPill.js"
import { getFilterAriaLabel, getFilterIcon } from "./searchUtils.js"
import { useSearchContext } from "./SearchContext.js"

export const SearchActiveFilters = () => {
    const {
        state: { filters },
        actions: { removeCountry, removeTopic, removeFilter },
    } = useSearchContext()
    return (
        <>
            {filters.map((filter) =>
                match(filter)
                    .with({ type: FilterType.COUNTRY }, (filter) => (
                        <button
                            key={filter.name}
                            type="button"
                            aria-label={getFilterAriaLabel(filter, "remove")}
                            onClick={() => removeCountry(filter.name)}
                            className="search-active-filter-button"
                        >
                            <SearchFilterPill
                                name={filter.name}
                                icon={getFilterIcon(filter)}
                                selected
                            />
                        </button>
                    ))
                    .with({ type: FilterType.TOPIC }, (filter) => (
                        <button
                            key={`topic-${filter.name}`}
                            type="button"
                            aria-label={getFilterAriaLabel(filter, "remove")}
                            onClick={() => removeTopic(filter.name)}
                            className="search-active-filter-button"
                            data-testid={`search-active-filter-button-${
                                filter.type
                            }-${encodeURIComponent(filter.name)}`}
                        >
                            <SearchFilterPill
                                name={filter.name}
                                icon={getFilterIcon(filter)}
                                selected
                            />
                        </button>
                    ))
                    .with(
                        { type: FilterType.DATASET_PRODUCT },
                        { type: FilterType.DATASET_NAMESPACE },
                        { type: FilterType.DATASET_VERSION },
                        (filter) => (
                            <button
                                key={`${filter.type}-${filter.name}`}
                                type="button"
                                aria-label={getFilterAriaLabel(
                                    filter,
                                    "remove"
                                )}
                                onClick={() => removeFilter(filter)}
                                className="search-active-filter-button"
                            >
                                <SearchFilterPill
                                    name={filter.name}
                                    icon={getFilterIcon(filter)}
                                    selected
                                />
                            </button>
                        )
                    )
                    .with({ type: FilterType.QUERY }, (_filter) => null)
                    .exhaustive()
            )}
        </>
    )
}
