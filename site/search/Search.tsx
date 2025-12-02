import {
    TagGraphRoot,
    SearchState,
    FilterType,
    TemplateConfig,
    SearchResultType,
} from "@ourworldindata/types"
import { LiteClient } from "algoliasearch/lite"
import { useReducer, useMemo, useDeferredValue } from "react"
import { match } from "ts-pattern"
import { useIsFetching } from "@tanstack/react-query"

// Search state and types
import { searchReducer, createActions } from "./searchState.js"

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
    liteSearchClient,
}: {
    initialState: SearchState
    topicTagGraph: TagGraphRoot
    liteSearchClient: LiteClient
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

    // Derived state for template configuration Use immediate state to avoid
    // firing duplicate queries (one for the current (deferred) template, one for the
    // target template after deferred value catches up)
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
        <SearchContext.Provider
            value={{
                state,
                deferredState,
                actions,
                liteSearchClient,
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
