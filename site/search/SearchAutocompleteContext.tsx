import { createContext, useContext } from "react"
import { Filter } from "@ourworldindata/types"

export interface SearchAutocompleteContextType {
    activeIndex: number
    setActiveIndex: (index: number) => void
    suggestions: Filter[]
    setSuggestions: (suggestions: Filter[]) => void
    // The suggestions plus the "Try AI search" row after them, which is only
    // shown with suggestions
    itemCount: number
    showSuggestions: boolean
    setShowSuggestions: (isOpen: boolean) => void
    onSelectActiveItem: () => void
    // The handler gets no filter for the AI search row
    registerSelectionHandler: (
        handler: (filter: Filter | undefined, index: number) => void
    ) => void
}

export const SearchAutocompleteContext = createContext<
    SearchAutocompleteContextType | undefined
>(undefined)

export function useSearchAutocomplete() {
    const context = useContext(SearchAutocompleteContext)
    if (context === undefined) {
        throw new Error(
            "useSearchAutocomplete must be used within a SearchAutocompleteContextProvider"
        )
    }
    return context
}
