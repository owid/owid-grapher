import { getAlgoliaFacets } from "@algolia/autocomplete-js"
import { SearchClient } from "algoliasearch/lite.js"
import { PAGES_INDEX } from "./SearchApp.js"

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
                        item({ item, components, html }: any) {
                            return html`<div className="aa-ItemWrapper">
                                <div className="aa-ItemContent">
                                    <div className="aa-ItemContentBody">
                                        <div className="aa-ItemContentTitle">
                                            ${components.Highlight({
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
                                        <svg
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            </div>`
                        },
                    },
                },
            ]
        },
    }
}
