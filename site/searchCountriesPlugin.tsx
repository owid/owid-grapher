import React from "react"
import { getAlgoliaResults } from "@algolia/autocomplete-js"
import { SearchClient } from "algoliasearch/lite.js"
import { PAGES_INDEX } from "./SearchApp.js"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight"
import { SearchAutocompleteSectionHeader } from "./SearchAutocompleteSectionHeader.js"

type ArticleHit = {
    title: string
    slug: string
}

export const createSearchCountriesPlugin = (searchClient: SearchClient) => {
    return {
        getSources() {
            return [
                {
                    sourceId: "countries",
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
                        item({
                            item,
                            components,
                        }: {
                            item: ArticleHit
                            components: any
                        }) {
                            return (
                                <div className="aa-ItemWrapper">
                                    <div className="aa-ItemContent">
                                        <div className="aa-ItemContentBody">
                                            <div className="aa-ItemContentTitle">
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
                                            <FontAwesomeIcon
                                                icon={faArrowRight}
                                            />
                                        </button>
                                    </div>
                                </div>
                            )
                        },

                        header() {
                            return (
                                <SearchAutocompleteSectionHeader label="Countries" />
                            )
                        },
                    },
                    getItemUrl({ item }: { item: ArticleHit }) {
                        return `${BAKED_BASE_URL}/country/${item.slug}`
                    },
                },
            ]
        },
    }
}
