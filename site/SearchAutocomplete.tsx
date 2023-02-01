import React from "react"
import { createElement, Fragment, useEffect, useRef, useState } from "react"
import { render } from "react-dom"
import { usePagination, useSearchBox } from "react-instantsearch-hooks"
import { autocomplete } from "@algolia/autocomplete-js"
import { BaseItem } from "@algolia/autocomplete-core"
import type { AutocompleteOptions, Render } from "@algolia/autocomplete-js"
import "@algolia/autocomplete-theme-classic"
import "@algolia/autocomplete-plugin-tags/dist/theme.min.css"
import { SearchClient } from "algoliasearch/lite.js"
import { BaseTag } from "@algolia/autocomplete-plugin-tags"
import { useInstantSearch } from "react-instantsearch-hooks-web"
import { createSearchTagsPlugin } from "./searchTagsPlugin.js"
import { createSearchArticlesPlugin } from "./searchArticlesPlugin.js"
import { createLocalStorageRecentSearchesPlugin } from "@algolia/autocomplete-plugin-recent-searches"
import { createShowTagsPlugin } from "./showTagsPlugin.js"
import { createSearchCountriesPlugin } from "./searchCountriesPlugin.js"
import { debounce } from "@algolia/autocomplete-shared"
import { ChartHit } from "./SearchChartsHits.js"

type AutocompleteProps = Partial<AutocompleteOptions<BaseItem>> & {
    className?: string
    searchClient: SearchClient
}

type SetInstantSearchUiStateOptions = {
    query: string
    tags?: string[]
    countries?: string[]
    charts?: ChartHit[]
}

export function SearchAutocomplete({
    className,
    searchClient,
    setEntities,
    setCharts,
    setTags,
    ...autocompleteProps
}: AutocompleteProps & {
    setEntities: React.Dispatch<React.SetStateAction<string[]>>
    setCharts: React.Dispatch<React.SetStateAction<ChartHit[]>>
    setTags: React.Dispatch<React.SetStateAction<string[]>>
}) {
    const autocompleteContainer = useRef<HTMLDivElement>(null)

    const { query, refine: setQuery } = useSearchBox()
    const { refine: setPage } = usePagination()
    const { setIndexUiState } = useInstantSearch()

    const [instantSearchUiState, setInstantSearchUiState] =
        useState<SetInstantSearchUiStateOptions>({ query })

    const debouncedSetInstantSearchUiState = debounce(
        setInstantSearchUiState,
        500
    )

    useEffect(() => {
        setQuery(instantSearchUiState.query)
        setPage(0)
        setIndexUiState((prevIndexUiState: any) => {
            if (!instantSearchUiState.tags) return prevIndexUiState

            setEntities(instantSearchUiState.countries || [])
            setCharts(instantSearchUiState.charts || [])
            setTags(instantSearchUiState.tags || [])

            return {
                ...prevIndexUiState,
                refinementList: {
                    ...prevIndexUiState.refinementList,
                    _tags: instantSearchUiState.tags,
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
                debouncedSetInstantSearchUiState({
                    query: state.query,
                    tags: Array.from(
                        new Set([
                            ...state.context.tagsPlugin.tags
                                .filter((tag: BaseTag) => tag.facet === "_tags")
                                .map((tag: BaseTag) => tag.label),

                            ...state.context.tagsPlugin.tags
                                .filter((tag: BaseTag) => tag.type === "chart")
                                .flatMap((item: BaseTag) => item._tags),
                        ])
                    ),
                    countries: state.context.tagsPlugin.tags
                        .filter((tag: BaseTag) => tag.type === "country")
                        .map((tag: BaseTag) => tag.title),
                    charts: state.context.tagsPlugin.tags
                        .filter((tag: BaseTag) => tag.type === "chart")
                        .map((tag: BaseTag) => {
                            return { title: tag.title, slug: tag.slug }
                        }),
                })
            },
            renderer: { createElement, Fragment, render: render as Render },
            plugins: [
                recentSearchesPlugin,
                createShowTagsPlugin(),
                createSearchTagsPlugin(searchClient),
                createSearchCountriesPlugin(searchClient),
                createSearchArticlesPlugin(searchClient),
            ],
        })

        return () => autocompleteInstance.destroy()
    }, [])

    return <div className={className} ref={autocompleteContainer} />
}

const recentSearchesPlugin = createLocalStorageRecentSearchesPlugin({
    key: "RECENT_SEARCHES",
    limit: 5,
})
