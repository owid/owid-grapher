import { createContext, useContext } from "react"
import { SearchState } from "./searchTypes.js"
import { createActions } from "./searchState.js"

type SearchActions = ReturnType<typeof createActions>

interface SearchContextType {
    state: SearchState
    actions: SearchActions
}

export const SearchContext = createContext<SearchContextType | null>(null)

export const useSearchContext = () => {
    const context = useContext(SearchContext)
    if (!context) {
        throw new Error(
            "useSearchContext must be used within a SearchContext.Provider"
        )
    }
    return context
}
