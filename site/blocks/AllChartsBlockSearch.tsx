import * as React from "react"
import { useRef } from "react"
import {
    faCircleXmark,
    faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { AllChartsBlockSuggestions } from "./AllChartsBlockSuggestions.js"

export function AllChartsBlockSearch({
    query,
    onQueryChange,
    suggestedTerms,
    isLoadingSuggestions,
    onSuggestionSelect,
}: {
    query: string
    onQueryChange: (query: string) => void
    suggestedTerms: string[]
    isLoadingSuggestions: boolean
    onSuggestionSelect: (term: string) => void
}): React.ReactElement {
    const inputRef = useRef<HTMLInputElement>(null)
    return (
        <>
            <div className="all-charts-block-search">
                <div className="all-charts-block-search__field" role="search">
                    <FontAwesomeIcon
                        className="all-charts-block-search__icon"
                        icon={faMagnifyingGlass}
                    />
                    <input
                        ref={inputRef}
                        type="search"
                        className="all-charts-block-search__input"
                        aria-label="Search charts on this topic"
                        placeholder="Search indicators by name, keyword, country, or source…"
                        autoComplete="off"
                        enterKeyHint="search"
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") onQueryChange("")
                        }}
                    />
                    {query !== "" && (
                        <button
                            type="button"
                            className="all-charts-block-search__clear"
                            aria-label="Clear search"
                            onClick={() => {
                                onQueryChange("")
                                inputRef.current?.focus()
                            }}
                        >
                            <FontAwesomeIcon icon={faCircleXmark} />
                        </button>
                    )}
                </div>
            </div>
            <AllChartsBlockSuggestions
                terms={suggestedTerms}
                isLoading={isLoadingSuggestions}
                onSelect={(term) => {
                    onSuggestionSelect(term)
                    inputRef.current?.focus()
                }}
            />
        </>
    )
}
