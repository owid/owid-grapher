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
import { getFilterNamesOfType, getSelectedTopicType, getEffectiveResultType } from "./searchUtils.js"
import {
    useUrlSync,
    useTagGraphTopics,
    useSearchAnalytics,
} from "./searchHooks.js"

// Components
import { Searchbar } from "./Searchbar.js"
import { SearchTopicsRefinementList } from "./SearchTopicsRefinementList.js"
import { SearchAsDraft } from "./SearchAsDraft.js"
import { SearchContext } from "./SearchContext.js"
import { SearchResultTypeToggle } from "./SearchResultTypeToggle.js"
import { SearchTemplatesAll } from "./SearchTemplatesAll.js"
import { SearchTemplatesData } from "./SearchTemplatesData.js"
import { SearchTemplatesWriting } from "./SearchTemplatesWriting.js"
import { SearchDebugNavigator } from "./SearchDebugNavigator.js"
import { SearchDebugProvider } from "./SearchDebugProvider.js"
import { SearchDataTopicsResultsSkeleton } from "./SearchDataTopicsResultsSkeleton.js"
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

    // Loading state
    const isFetching = useIsFetching()

    // Derived state for template configuration
    const topicType = getSelectedTopicType(state.filters, allAreas)
    const templateConfig: TemplateConfig = {
        resultType: getEffectiveResultType(state.filters, state.query, state.resultType),
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
                <div className="search-header span-cols-14 grid grid-cols-12-full-width">
                    <header className="search-heading span-cols-12 col-start-2">
                        <h1 className="h1-semibold">Search & Explore</h1>
                        <p className="body-2-regular">
                            Search for a specific chart, topic or article or
                            explore all our content.
                        </p>
                    </header>
                    <div className="search-controls-container span-cols-12 col-start-2">
                        <Searchbar allTopics={allTopics} />
                    </div>
                </div>
                <SearchDebugNavigator
                    availableAreas={allAreas}
                    availableTopics={allTopics}
                />
                <SearchTopicsRefinementList topicType={topicType} />
                <SearchAsDraft
                    className="col-start-11 span-cols-3 as-draft--align-self-start"
                    name="Search result type"
                >
                    <SearchResultTypeToggle />
                </SearchAsDraft>
                <div className="search-template-results grid span-cols-14 grid grid-cols-12-full-width">
                    {isInitialUrlStateLoaded && !isFetching ? (
                        match(templateConfig.resultType)
                            .with(SearchResultType.ALL, () => (
                                <SearchTemplatesAll />
                            ))
                            .with(SearchResultType.DATA, () => (
                                <SearchTemplatesData />
                            ))
                            .with(SearchResultType.WRITING, () => (
                                <SearchTemplatesWriting />
                            ))
                            .exhaustive()
                    ) : (
                        <SearchDataTopicsResultsSkeleton />
                    )}
                    <SearchNoResults />
                </div>
            </SearchContext.Provider>
        </SearchDebugProvider>
    )
}
