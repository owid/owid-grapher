import { AutocompleteSource } from "@algolia/autocomplete-js"
import { countriesByName } from "@ourworldindata/utils"
import { CountryPill } from "./CountryPill.js"
import { BaseItem } from "./DataCatalogAutocomplete.js"
import { CatalogFilter, CatalogFilterType } from "./DataCatalogState.js"
import { AutocompleteSources } from "./DataCatalogUtils.js"
import { TopicPill } from "./TopicPill.js"

export const CombinedFiltersSource = (
    addPendingFilter: (filter: CatalogFilter) => void,
    clearSearch: () => void
): AutocompleteSource<BaseItem> => {
    return {
        sourceId: AutocompleteSources.COMBINED_FILTERS,
        onSelect({ item }) {
            // Apply the topic
            if (item.topic) {
                addPendingFilter({
                    type: CatalogFilterType.TOPIC,
                    name: item.topic as string,
                })
            }

            // Apply all countries
            if (item.countries) {
                ;(item.countries as string[]).forEach((country) => {
                    addPendingFilter({
                        type: CatalogFilterType.COUNTRY,
                        name: country,
                    })
                })
            }

            clearSearch()
        },
        getItemUrl() {
            return undefined
        },
        getItems() {
            // This is a placeholder - actual items are provided through the reshape function
            return []
        },
        templates: {
            header: () => {
                return (
                    <h5 className="overline-black-caps">🧪 Combined Filters</h5>
                )
            },
            item: ({ item }) => {
                const countries = (item.countries as string[]) || []
                const topic = item.topic as string | undefined

                return (
                    <div className="aa-ItemWrapper aa-CombinedFiltersWrapper">
                        <div className="aa-ItemContent">
                            <div
                                className="aa-ItemContentBody"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    gap: "4px",
                                }}
                            >
                                {topic && <TopicPill name={topic} />}
                                {countries.length > 0 && (
                                    <div
                                        style={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: "4px",
                                        }}
                                    >
                                        {countries.map((country) => (
                                            <CountryPill
                                                key={country}
                                                name={country}
                                                code={
                                                    countriesByName()[country]
                                                        ?.code || ""
                                                }
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            },
        },
    }
}
