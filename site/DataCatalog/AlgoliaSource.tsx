import { AutocompleteSource, getAlgoliaResults } from "@algolia/autocomplete-js"
import { getIndexName, parseIndexName } from "../search/searchClient.js"
import { SearchIndexName } from "../search/searchTypes.js"
import { BaseItem } from "./DataCatalogAutocomplete.js"
import {
    analytics,
    AutocompleteItemType,
    prependSubdirectoryToAlgoliaItemUrl,
    searchClient,
    AutocompleteSources,
} from "./DataCatalogUtils.js"

export const AlgoliaSource: AutocompleteSource<BaseItem> = {
    sourceId: AutocompleteSources.AUTOCOMPLETE,
    onSelect({ navigator, item, state }) {
        const itemUrl = prependSubdirectoryToAlgoliaItemUrl(item)
        analytics.logInstantSearchClick({
            query: state.query,
            url: itemUrl,
            position: String(state.activeItemId),
        })
        navigator.navigate({ itemUrl, item, state })
    },
    getItemUrl({ item }) {
        const itemUrl = prependSubdirectoryToAlgoliaItemUrl(item)
        return itemUrl
    },
    getItems({ query }) {
        return getAlgoliaResults({
            searchClient,
            queries: [
                {
                    indexName: getIndexName(SearchIndexName.Pages),
                    query,
                    params: {
                        hitsPerPage: 2,
                        distinct: true,
                        filters: `NOT type:${AutocompleteItemType.TopicPage} AND NOT type:${AutocompleteItemType.Country}`,
                    },
                },
                {
                    indexName: getIndexName(SearchIndexName.Charts),
                    query,
                    params: {
                        hitsPerPage: 2,
                        distinct: true,
                    },
                },
                {
                    indexName: getIndexName(SearchIndexName.ExplorerViews),
                    query,
                    params: {
                        hitsPerPage: 1,
                        distinct: true,
                    },
                },
            ],
        })
    },

    templates: {
        header: () => <h5 className="overline-black-caps">Top Results</h5>,
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
                    <span>
                        <components.Highlight
                            hit={item}
                            attribute={mainAttribute}
                            tagName="strong"
                        />
                    </span>
                </div>
            )
        },
    },
}
