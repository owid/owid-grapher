import { CatalogFilter, CatalogFilterType } from "./DataCatalogState.js"
import { CountryPill } from "./CountryPill.js"
import { TopicPill } from "./TopicPill.js"
import { countriesByName } from "@ourworldindata/utils"
import { match } from "ts-pattern"

export const DataCatalogAppliedFilters = ({
    filters,
    removeFilter,
}: {
    filters: CatalogFilter[]
    removeFilter?: (filter: CatalogFilter) => void
}) => {
    if (filters.length === 0) return null

    return (
        <ul className="data-catalog-applied-filters">
            {filters.map((filter) => (
                <li
                    key={`${filter.type}-${filter.name}`}
                    className="selected-filter-item"
                >
                    {match(filter)
                        .with({ type: CatalogFilterType.COUNTRY }, (filter) => (
                            <CountryPill
                                name={filter.name}
                                code={
                                    countriesByName()[filter.name]?.code || ""
                                }
                                onRemove={removeFilter}
                            />
                        ))
                        .with({ type: CatalogFilterType.TOPIC }, (filter) => (
                            <TopicPill
                                name={filter.name}
                                onRemove={removeFilter}
                            />
                        ))
                        .exhaustive()}
                </li>
            ))}
        </ul>
    )
}
