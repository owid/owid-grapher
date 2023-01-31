import React from "react"
import { getAlgoliaFacets, getAlgoliaResults } from "@algolia/autocomplete-js"
import { SearchClient } from "algoliasearch/lite.js"
import { CHARTS_INDEX, PAGES_INDEX } from "./SearchApp.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faFilter } from "@fortawesome/free-solid-svg-icons/faFilter"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { flag } from "country-emoji"
import { SearchAutocompleteSectionHeader } from "./SearchAutocompleteSectionHeader.js"

export const createSearchTagsPlugin = (searchClient: SearchClient) => {
    return {
        getSources() {
            return [
                {
                    sourceId: "tags",
                    onSelect({ item, setQuery }: any) {
                        // TODO?
                        // if (
                        //     item.label
                        //         .toLowerCase()
                        //         .includes(query.toLowerCase())
                        // ) {
                        setQuery("")
                        // }
                    },
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
                                return facetHits[0]
                                    .filter(
                                        (hit) =>
                                            ![
                                                "Entries",
                                                "Uncategorized",
                                            ].includes(hit.label)
                                    )
                                    .map((hit) => ({
                                        ...hit,
                                        facet: "_tags",
                                    }))
                            },
                        })
                    },
                    templates: {
                        header() {
                            return (
                                <SearchAutocompleteSectionHeader label="Filter by tag" />
                            )
                        },
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
                {
                    sourceId: "countryTags",
                    onSelect({ item, setQuery }: any) {
                        // TODO?
                        // if (
                        //     item.label
                        //         .toLowerCase()
                        //         .includes(query.toLowerCase())
                        // ) {
                        setQuery("")
                        // }
                    },
                    getItems({ query }: { query: string }) {
                        return getAlgoliaResults({
                            searchClient,
                            queries: [
                                {
                                    indexName: PAGES_INDEX,
                                    query,
                                    params: {
                                        hitsPerPage: 2,
                                        filters: "type:country",
                                    },
                                },
                            ],
                        })
                    },
                    templates: {
                        header() {
                            return (
                                <SearchAutocompleteSectionHeader label="Filter by country" />
                            )
                        },
                        item({ item, components }: any) {
                            return (
                                <div className="aa-ItemWrapper">
                                    <div className="aa-ItemContent">
                                        <div className="aa-ItemContentBody">
                                            <div className="aa-ItemContentTitle">
                                                {flag(item.title)}&nbsp;
                                                {components.Highlight({
                                                    hit: item,
                                                    attribute: "title",
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
                {
                    sourceId: "chartTags",
                    onSelect({ item, setQuery }: any) {
                        // TODO?
                        // if (
                        //     item.label
                        //         .toLowerCase()
                        //         .includes(query.toLowerCase())
                        // ) {
                        setQuery("")
                        // }
                    },
                    getItems({ query }: { query: string }) {
                        return getAlgoliaResults({
                            searchClient,
                            queries: [
                                {
                                    indexName: CHARTS_INDEX,
                                    query,
                                    params: {
                                        hitsPerPage: 2,
                                    },
                                },
                            ],
                            transformResponse({ hits }) {
                                console.log(hits[0])
                                return hits[0].map((hit) => ({
                                    ...hit,
                                    type: "chart",
                                }))
                            },
                        })
                    },
                    templates: {
                        header() {
                            return (
                                <SearchAutocompleteSectionHeader label="Filter by chart" />
                            )
                        },
                        item({ item, components }: any) {
                            return (
                                <div className="aa-ItemWrapper">
                                    <div className="aa-ItemContent">
                                        <div className="aa-ItemContentBody">
                                            <div className="aa-ItemContentTitle">
                                                <FontAwesomeIcon
                                                    icon={faChartLine}
                                                />{" "}
                                                {components.Highlight({
                                                    hit: item,
                                                    attribute: "title",
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
