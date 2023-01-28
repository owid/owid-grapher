import React from "react"
import { getAlgoliaResults } from "@algolia/autocomplete-js"
import { SearchClient } from "algoliasearch/lite.js"
import { PAGES_INDEX } from "./SearchApp.js"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"

type ArticleHit = {
    title: string
    slug: string
}

export const createSearchArticlesPlugin = (searchClient: SearchClient) => {
    return {
        getSources() {
            return [
                {
                    sourceId: "articles",
                    getItems({ query }: { query: string }) {
                        return getAlgoliaResults({
                            searchClient,
                            queries: [
                                {
                                    indexName: PAGES_INDEX,
                                    query,
                                    params: {
                                        hitsPerPage: 2,
                                        filters: "type:post",
                                    },
                                },
                            ],
                        })
                    },

                    templates: {
                        item({
                            item,
                            components,
                            html,
                        }: {
                            item: ArticleHit
                            components: any
                            html: any
                        }) {
                            return html`<div className="aa-ItemWrapper">
                                <div className="aa-ItemContent">
                                    <div className="aa-ItemContentBody">
                                        <div className="aa-ItemContentTitle">
                                            ${components.Highlight({
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

                        header({ items }: { items: ArticleHit[] }) {
                            if (items.length === 0) {
                                return null
                            }

                            return (
                                <>
                                    <span className="aa-SourceHeaderTitle">
                                        Articles
                                    </span>
                                    <div className="aa-SourceHeaderLine" />
                                </>
                            )
                        },
                    },
                    getItemUrl({ item }: { item: ArticleHit }) {
                        return `${BAKED_BASE_URL}/${item.slug}`
                    },
                },
            ]
        },
    }
}
