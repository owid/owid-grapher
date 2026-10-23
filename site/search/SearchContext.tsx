import { createContext, useContext } from "react"
import {
    SearchState,
    SynonymMap,
    TemplateConfig,
    TagGraphRoot,
    SearchActions,
} from "@ourworldindata/types"
import { LiteClient } from "algoliasearch/lite"
import { SiteAnalytics } from "../SiteAnalytics.js"

/**
 * The AI-assisted search prototype (SearchAiResults). It isn't part of the URL
 * state: it shows for the query it was started with, until the reader closes
 * it or changes the search.
 */
export interface AiSearchControls {
    query: string | null
    start: (query: string) => void
    close: () => void
}

interface SearchContextType {
    state: SearchState
    actions: SearchActions
    liteSearchClient: LiteClient
    templateConfig: TemplateConfig
    topicTagGraph: TagGraphRoot
    synonymMap: SynonymMap
    analytics: SiteAnalytics
    aiSearch: AiSearchControls
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
