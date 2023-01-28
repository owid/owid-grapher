import React from "react"
import { getAlgoliaFacets } from "@algolia/autocomplete-js"
import { SearchClient } from "algoliasearch/lite.js"
import { PAGES_INDEX } from "./SearchApp.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faFilter } from "@fortawesome/free-solid-svg-icons/faFilter"

export const createSearchTopicsPlugin = (searchClient: SearchClient) => {
    return {
        getSources() {
            return [
                {
                    sourceId: "topics",
                    getItems({ query }: { query: string }) {
                        return getAlgoliaFacets({
                            searchClient,
                            queries: [
                                {
                                    indexName: PAGES_INDEX,
                                    facet: "_tags",
                                    params: {
                                        facetQuery: query,
                                        maxFacetHits: 5,
                                    },
                                },
                            ],
                            transformResponse({ facetHits }) {
                                return facetHits[0].map((hit) => ({
                                    ...hit,
                                    facet: "_tags",
                                }))
                            },
                        })
                    },
                    templates: {
                        item({ item, components }: any) {
                            return (
                                <div className="aa-ItemWrapper">
                                    <div className="aa-ItemContent">
                                        <div className="aa-ItemContentBody">
                                            <div className="aa-ItemContentTitle">
                                                {components.Highlight({
                                                    hit: item,
                                                    attribute: "label",
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="aa-ItemActions">
                                        <button
                                            className="aa-ItemActionButton aa-DesktopOnly aa-ActiveOnly"
                                            type="button"
                                            title="Filter"
                                        >
                                            <FontAwesomeIcon icon={faFilter} />
                                        </button>
                                    </div>
                                </div>
                            )
                        },
                    },
                },
            ]
        },
    }
}
