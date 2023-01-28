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
import { BaseTag, createTagsPlugin } from "@algolia/autocomplete-plugin-tags"
import { useInstantSearch } from "react-instantsearch-hooks-web"
import { createSearchTopicsPlugin } from "./searchPluginTopics.js"

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
    const { setIndexUiState } = useInstantSearch()

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
            plugins: [tagsPlugin, createSearchTopicsPlugin(searchClient)],
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
