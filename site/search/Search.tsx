import { TagGraphRoot } from "@ourworldindata/types"
import { SearchClient } from "algoliasearch"
import { useReducer, useMemo } from "react"
import { match } from "ts-pattern"
import { useIsFetching } from "@tanstack/react-query"

// Search state and types
import { searchReducer, createActions } from "./searchState.js"
import {
    SearchState,
    FilterType,
    TemplateConfig,
    SearchResultType,
} from "./searchTypes.js"

// Utils and hooks
import {
    getFilterNamesOfType,
    getSelectedTopicType,
    getEffectiveResultType,
} from "./searchUtils.js"
import {
    useUrlSync,
    useTagGraphTopics,
    useSearchAnalytics,
} from "./searchHooks.js"

// Components
import { Searchbar } from "./Searchbar.js"
import { SearchTopicsRefinementList } from "./SearchTopicsRefinementList.js"
import { SearchContext } from "./SearchContext.js"
import { SearchResultTypeToggle } from "./SearchResultTypeToggle.js"
import { SearchTemplatesAll } from "./SearchTemplatesAll.js"
import { SearchTemplatesData } from "./SearchTemplatesData.js"
import { SearchTemplatesWriting } from "./SearchTemplatesWriting.js"
import { SearchDebugNavigator } from "./SearchDebugNavigator.js"
import { SearchDebugProvider } from "./SearchDebugProvider.js"
import { SearchNoResults } from "./SearchNoResults.js"

export const Search = ({
    initialState,
    topicTagGraph,
    searchClient,
}: {
    initialState: SearchState
    topicTagGraph: TagGraphRoot
    searchClient: SearchClient
}) => {
    // State management
    const [state, dispatch] = useReducer(searchReducer, initialState)
    const actions = useMemo(() => createActions(dispatch), [dispatch])

    // Extract topic and area data from the graph
    const { allAreas, allTopics } = useTagGraphTopics(topicTagGraph)

    // Bidirectional URL synchronization
    const isInitialUrlStateLoaded = useUrlSync(state, actions.setState)

    // Handle analytics tracking
    useSearchAnalytics(state, isInitialUrlStateLoaded)

    const isFetching = useIsFetching()

    // Derived state for template configuration
    const topicType = getSelectedTopicType(state.filters, allAreas)
    const templateConfig: TemplateConfig = {
        resultType: getEffectiveResultType(
            state.filters,
            state.query,
            state.resultType
        ),
        topicType,
        hasCountry:
            getFilterNamesOfType(state.filters, FilterType.COUNTRY).size > 0,
        hasQuery: state.query.length > 0,
    }

    return (
        <SearchDebugProvider>
            <SearchContext.Provider
                value={{
                    state,
                    actions,
                    searchClient,
                    templateConfig,
                    topicTagGraph,
                }}
            >
                <div className="search-controls-container span-cols-12 col-start-2">
                    <Searchbar allTopics={allTopics} />
                </div>
                <SearchDebugNavigator
                    availableAreas={allAreas}
                    availableTopics={allTopics}
                />
                <div className="search-filters span-cols-12 col-start-2">
                    <SearchTopicsRefinementList topicType={topicType} />
                    <SearchResultTypeToggle />
                </div>
                <div className="search-template-results col-start-2 span-cols-12">
                    {!isFetching && <SearchNoResults />}
                    {match(templateConfig.resultType)
                        .with(SearchResultType.ALL, () => (
                            <SearchTemplatesAll />
                        ))
                        .with(SearchResultType.DATA, () => (
                            <SearchTemplatesData />
                        ))
                        .with(SearchResultType.WRITING, () => (
                            <SearchTemplatesWriting />
                        ))
                        .exhaustive()}
                </div>
            </SearchContext.Provider>
        </SearchDebugProvider>
    )
}
