import { match } from "ts-pattern"
import { Filter, FilterType } from "./searchTypes"
import {
    SearchCountryPillIcon,
    SearchFilterPill,
    SearchTopicPillIcon,
} from "./SearchFilterPill.js"

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
        <div className="search-selected-filters-container">
            {filters.map((filter) =>
                match(filter)
                    .with({ type: FilterType.COUNTRY }, ({ name }) => (
                        <button
                            key={name}
                            aria-label={`Remove ${name}`}
                            onClick={() => removeCountry(name)}
                            className="search-selected-filter-button"
                        >
                            <SearchFilterPill
                                name={name}
                                icon={SearchCountryPillIcon(name)}
                                hasCloseIcon
                            />
                        </button>
                    ))
                    .with({ type: FilterType.TOPIC }, ({ name }) => (
                        <button
                            key={`topic-${name}`}
                            aria-label={`Remove ${name}`}
                            onClick={() => removeTopic(name)}
                            className="search-selected-filter-button"
                        >
                            <SearchFilterPill
                                name={name}
                                icon={SearchTopicPillIcon}
                                hasCloseIcon
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
