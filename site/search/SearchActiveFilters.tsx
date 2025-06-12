import { match } from "ts-pattern"
import { Filter, FilterType } from "./searchTypes"
import { SearchFilterPill } from "./SearchFilterPill.js"
import { getFilterAriaLabel, getFilterIcon } from "./searchUtils.js"

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
        </>
    )
}
