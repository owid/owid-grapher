import { createContext, useContext } from "react"
import {
    SearchState,
    SynonymMap,
    TemplateConfig,
    TagGraphRoot,
    SearchActions,
} from "@ourworldindata/types"
import { TypesenseConfig } from "@ourworldindata/utils"
import { SiteAnalytics } from "../SiteAnalytics.js"

interface SearchContextType {
    state: SearchState
    actions: SearchActions
    typesenseConfig: TypesenseConfig
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
