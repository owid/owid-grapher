import { match } from "ts-pattern"
import { Filter, FilterType } from "./searchTypes"
import { SearchFilterPill } from "./SearchFilterPill.js"
import { getFilterIcon } from "./searchUtils.js"

export const SearchActiveFilters = ({
    filters,
    removeCountry,
    removeTopic,
}: {
    filters: Filter[]
    removeCountry: (country: string) => void
    removeTopic: (topic: string) => void
}) => {
    return (
        <div className="search-active-filters-container">
            {filters.map((filter) =>
                match(filter)
                    .with({ type: FilterType.COUNTRY }, (filter) => (
                        <button
                            key={filter.name}
                            aria-label={`Remove ${filter.name}`}
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
                            aria-label={`Remove ${filter.name}`}
                            onClick={() => removeTopic(filter.name)}
                            className="search-active-filter-button"
                        >
                            <SearchFilterPill
                                name={filter.name}
                                icon={getFilterIcon(filter)}
                                selected
                            />
                        </button>
                    ))
                    .otherwise(() => {
                        return null
                    })
            )}
        </div>
    )
}
