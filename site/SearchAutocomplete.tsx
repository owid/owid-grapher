import React from "react"
import { createElement, Fragment, useEffect, useRef, useState } from "react"
import { render } from "react-dom"
import { usePagination, useSearchBox } from "react-instantsearch-hooks"
import { autocomplete, getAlgoliaFacets } from "@algolia/autocomplete-js"
import { BaseItem } from "@algolia/autocomplete-core"
import type { AutocompleteOptions, Render } from "@algolia/autocomplete-js"
import "@algolia/autocomplete-theme-classic"
import "@algolia/autocomplete-plugin-tags/dist/theme.min.css"
import { SearchClient } from "algoliasearch/lite.js"
import { BaseTag, createTagsPlugin } from "@algolia/autocomplete-plugin-tags"
import { useInstantSearch } from "react-instantsearch-hooks-web"

type AutocompleteProps = Partial<AutocompleteOptions<BaseItem>> & {
    className?: string
    searchClient: SearchClient
}

type SetInstantSearchUiStateOptions = {
    query: string
    topics?: BaseTag[]
}

export function SearchAutocomplete({
    className,
    searchClient,
    ...autocompleteProps
}: AutocompleteProps) {
    const autocompleteContainer = useRef<HTMLDivElement>(null)

    const { query, refine: setQuery } = useSearchBox()
    const { refine: setPage } = usePagination()
    const { indexUiState, setIndexUiState } = useInstantSearch()

    const [instantSearchUiState, setInstantSearchUiState] =
        useState<SetInstantSearchUiStateOptions>({ query })

    useEffect(() => {
        setQuery(instantSearchUiState.query)
        setPage(0)
        setIndexUiState((prevIndexUiState: any) => {
            if (!instantSearchUiState.topics) return prevIndexUiState

            return {
                ...prevIndexUiState,
                refinementList: {
                    ...prevIndexUiState.refinementList,
                    _tags: instantSearchUiState.topics,
                },
            }
        })
    }, [instantSearchUiState])

    useEffect(() => {
        if (!autocompleteContainer.current) {
            return
        }

        const autocompleteInstance = autocomplete({
            ...autocompleteProps,
            container: autocompleteContainer.current,
            initialState: { query },
            onReset() {
                setInstantSearchUiState({ query: "" })
            },
            onSubmit({ state }) {
                setInstantSearchUiState({ query: state.query })
            },
            onStateChange({ prevState, state }: any) {
                // todo debounce
                setInstantSearchUiState({
                    query: state.query,
                    topics: state.context.tagsPlugin.tags.map(
                        (tag: BaseTag) => tag.label
                    ),
                })
            },
            renderer: { createElement, Fragment, render: render as Render },
            getSources: () => getSources(searchClient),
            plugins: [tagsPlugin],
        })

        return () => autocompleteInstance.destroy()
    }, [])

    return <div className={className} ref={autocompleteContainer} />
}

const tagsPlugin = createTagsPlugin({
    getTagsSubscribers() {
        return [
            {
                sourceId: "topics",
                getTag({ item }: any) {
                    return item
                },
            },
        ]
    },
})

function getSources(searchClient: SearchClient) {
    return [
        {
            sourceId: "topics",
            getItems({ query }: { query: string }) {
                return getAlgoliaFacets({
                    searchClient,
                    queries: [
                        {
                            indexName: "pages",
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
}
