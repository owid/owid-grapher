import React from "react"
import { createElement, Fragment, useEffect, useRef, useState } from "react"
import { render } from "react-dom"

import { usePagination, useSearchBox } from "react-instantsearch-hooks"
import { autocomplete } from "@algolia/autocomplete-js"
import { BaseItem } from "@algolia/autocomplete-core"
import type { AutocompleteOptions, Render } from "@algolia/autocomplete-js"
import "@algolia/autocomplete-theme-classic"

type AutocompleteProps = Partial<AutocompleteOptions<BaseItem>> & {
    className?: string
}

type SetInstantSearchUiStateOptions = {
    query: string
}

export function SearchAutocomplete({
    className,
    ...autocompleteProps
}: AutocompleteProps) {
    const autocompleteContainer = useRef<HTMLDivElement>(null)

    const { query, refine: setQuery } = useSearchBox()
    const { refine: setPage } = usePagination()

    const [instantSearchUiState, setInstantSearchUiState] =
        useState<SetInstantSearchUiStateOptions>({ query })

    useEffect(() => {
        setQuery(instantSearchUiState.query)
        setPage(0)
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
            onStateChange({ prevState, state }) {
                if (prevState.query !== state.query) {
                    setInstantSearchUiState({
                        query: state.query,
                    })
                }
            },
            renderer: { createElement, Fragment, render: render as Render },
        })

        return () => autocompleteInstance.destroy()
    }, [])

    return <div className={className} ref={autocompleteContainer} />
}
