import { AutocompleteSource, getAlgoliaResults } from "@algolia/autocomplete-js"
import { getIndexName, parseIndexName } from "../search/searchClient.js"
import { SearchIndexName } from "../search/searchTypes.js"
import { BaseItem } from "./DataCatalogAutocomplete.js"
import {
    analytics,
    searchClient,
    AutocompleteSources,
} from "./DataCatalogUtils.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

export const AlgoliaSource: AutocompleteSource<BaseItem> = {
    sourceId: AutocompleteSources.AUTOCOMPLETE,
    onSelect({ navigator, item, state }) {
        const itemUrl = `/data?q=${item.title}`
        analytics.logInstantSearchClick({
            query: state.query,
            url: itemUrl,
            position: String(state.activeItemId),
        })
        navigator.navigate({ itemUrl, item, state })
    },
    getItemUrl({ item }) {
        const itemUrl = `/data?q=${item.title}`
        return itemUrl
    },
    getItemInputValue({ item }) {
        return (item.title as string).toLowerCase()
    },
    getItems({ query }) {
        return getAlgoliaResults({
            searchClient,
            queries: [
                // {
                //     indexName: getIndexName(SearchIndexName.Pages),
                //     query,
                //     params: {
                //         hitsPerPage: 2,
                //         distinct: true,
                //         filters: `NOT type:${AutocompleteItemType.TopicPage} AND NOT type:${AutocompleteItemType.Country}`,
                //     },
                // },
                // {
                //     indexName: getIndexName(SearchIndexName.Charts),
                //     query,
                //     params: {
                //         hitsPerPage: 2,
                //         distinct: true,
                //     },
                // },
                {
                    indexName: getIndexName(
                        SearchIndexName.ExplorerViewsMdimViewsAndCharts
                    ),
                    query,
                    params: {
                        hitsPerPage: 3,
                        distinct: true,
                    },
                },
            ],
        })
    },

    templates: {
        item: ({ item, components }) => {
            const index = parseIndexName(
                item.__autocomplete_indexName as string
            )
            const mainAttribute =
                index === SearchIndexName.ExplorerViews ? "viewTitle" : "title"

            return (
                <div
                    className="aa-ItemWrapper"
                    key={item.title as string}
                    translate="no"
                >
                    <div className="aa-ItemContent">
                        <div className="aa-ItemIcon">
                            <FontAwesomeIcon icon={faSearch} />
                        </div>
                        <div style={{ textTransform: "lowercase" }}>
                            <components.Highlight
                                hit={item}
                                attribute={mainAttribute}
                                tagName="strong"
                            />
                        </div>
                    </div>
                </div>
            )
        },
    },
}
