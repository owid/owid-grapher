import { createContext, useContext } from "react"
import { SearchState, SynonymMap, TemplateConfig } from "./searchTypes.js"
import { createActions } from "./searchState.js"
import { TagGraphRoot } from "@ourworldindata/types"
import { SearchClient } from "algoliasearch"
import { SiteAnalytics } from "../SiteAnalytics.js"

type SearchActions = ReturnType<typeof createActions>

interface SearchContextType {
    state: SearchState
    deferredState: SearchState
    actions: SearchActions
    searchClient: SearchClient
    templateConfig: TemplateConfig
    topicTagGraph: TagGraphRoot
    synonymMap: SynonymMap
    analytics: SiteAnalytics
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
