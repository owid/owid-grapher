import { createContext, useContext } from "react"
import { Filter } from "./searchTypes.js"

export interface SearchAutocompleteContextType {
    activeIndex: number
    setActiveIndex: (index: number) => void
    suggestions: Filter[]
    setSuggestions: (suggestions: Filter[]) => void
    showSuggestions: boolean
    setShowSuggestions: (isOpen: boolean) => void
    onSelectActiveItem: () => void
    registerSelectionHandler: (
        handler: (filter: Filter, index: number) => void
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
