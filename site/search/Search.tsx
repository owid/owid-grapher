import { TagGraphRoot } from "@ourworldindata/types"
import { SearchClient } from "algoliasearch"
import { useReducer, useMemo, useDeferredValue } from "react"
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
    useSearchStateAnalytics,
} from "./searchHooks.js"

// Components
import { Searchbar } from "./Searchbar.js"
import { SearchTopicsRefinementList } from "./SearchTopicsRefinementList.js"
import { SearchContext } from "./SearchContext.js"
import { SearchResultTypeToggle } from "./SearchResultTypeToggle.js"
import { SearchTemplatesAll } from "./SearchTemplatesAll.js"
import { SearchTemplatesData } from "./SearchTemplatesData.js"
import { SearchTemplatesWriting } from "./SearchTemplatesWriting.js"
import { SearchNoResults } from "./SearchNoResults.js"
import { SearchDetectedFilters } from "./SearchDetectedFilters.js"
import { buildSynonymMap } from "./synonymUtils.js"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { PoweredBy } from "react-instantsearch"

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

    const synonymMap = useMemo(() => buildSynonymMap(), [])

    const analytics = useMemo(() => new SiteAnalytics(), [])

    const deferredState = useDeferredValue(state)

    // Bidirectional URL synchronization
    const isInitialUrlStateLoaded = useUrlSync(deferredState, actions.setState)

    // Handle analytics tracking
    useSearchStateAnalytics(deferredState, analytics, isInitialUrlStateLoaded)

    const isFetching = useIsFetching()

    // Derived state for template configuration
    const topicType = getSelectedTopicType(deferredState.filters, allAreas)
    const templateConfig: TemplateConfig = {
        resultType: getEffectiveResultType(
            deferredState.filters,
            deferredState.query,
            deferredState.resultType
        ),
        topicType,
        hasCountry:
            getFilterNamesOfType(deferredState.filters, FilterType.COUNTRY)
                .size > 0,
        hasQuery: deferredState.query.length > 0,
    }

    return (
        <SearchContext.Provider
            value={{
                state,
                deferredState,
                actions,
                searchClient,
                templateConfig,
                topicTagGraph,
                synonymMap,
                analytics,
            }}
        >
            <div className="search-controls-container span-cols-12 col-start-2">
                <Searchbar allTopics={allTopics} />
                <SearchDetectedFilters allTopics={allTopics} />
            </div>
            <div className="search-filters span-cols-12 col-start-2">
                <SearchTopicsRefinementList topicType={topicType} />
                <SearchResultTypeToggle />
            </div>
            <div className="search-template-results col-start-2 span-cols-12">
                {!isFetching && <SearchNoResults />}
                {match(templateConfig.resultType)
                    .with(SearchResultType.ALL, () => <SearchTemplatesAll />)
                    .with(SearchResultType.DATA, () => <SearchTemplatesData />)
                    .with(SearchResultType.WRITING, () => (
                        <SearchTemplatesWriting />
                    ))
                    .exhaustive()}
            </div>
            <PoweredBy
                className="col-start-2 span-cols-12"
                style={{ width: "200px", marginTop: "32px" }}
            />
        </SearchContext.Provider>
    )
}
