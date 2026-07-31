import { createContext, useContext } from "react"
import {
    SearchState,
    SynonymMap,
    TemplateConfig,
    TagGraphRoot,
    SearchActions,
} from "@ourworldindata/types"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { Client } from "typesense"

interface SearchContextType {
    state: SearchState
    actions: SearchActions
    typesenseClient: Client
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
