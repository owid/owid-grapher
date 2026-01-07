import {
    TagGraphRoot,
    FilterType,
    TemplateConfig,
    SearchResultType,
} from "@ourworldindata/types"
import { LiteClient } from "algoliasearch/lite"
import { useMemo } from "react"
import { match } from "ts-pattern"
import { useIsFetching } from "@tanstack/react-query"

// Utils and hooks
import {
    getFilterNamesOfType,
    getSelectedTopicType,
    getEffectiveResultType,
} from "./searchUtils.js"
import { useTagGraphTopics, useSearchAnalytics } from "./searchHooks.js"
import { stateToSearchParams, useSearchParamsState } from "./searchState.js"

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
import { listedRegionsNames } from "@ourworldindata/utils"

export const Search = ({
    topicTagGraph,
    liteSearchClient,
}: {
    topicTagGraph: TagGraphRoot
    liteSearchClient: LiteClient
}) => {
    // Extract topic and area data from the graph
    const { allAreas: eligibleAreas, allTopics: eligibleTopics } =
        useTagGraphTopics(topicTagGraph)

    const eligibleRegionNames = useMemo(() => listedRegionsNames(), [])
    const eligibleTopicsAndAreas = useMemo(
        () => [...eligibleAreas, ...eligibleTopics],
        [eligibleAreas, eligibleTopics]
    )

    const synonymMap = useMemo(() => buildSynonymMap(), [])

    // State derived from URL - single source of truth (includes automatic filter detection)
    const { state, actions } = useSearchParamsState(
        eligibleRegionNames,
        eligibleTopicsAndAreas,
        synonymMap
    )

    const analytics = useMemo(() => new SiteAnalytics(), [])

    // Handle analytics tracking (skips initial page load)
    useSearchAnalytics(state, analytics)

    const isFetching = useIsFetching()

    // Derived state for template configuration
    const topicType = getSelectedTopicType(state.filters, eligibleAreas)
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
                actions,
                liteSearchClient,
                templateConfig,
                topicTagGraph,
                synonymMap,
                analytics,
            }}
        >
            <div className="search-controls-container span-cols-12 col-start-2">
                <Searchbar
                    // force a component re-mount to sync local query state when
                    // global state updates. This is relevant in two cases:
                    // - a new global query is set (e.g. via autocomplete
                    //   selection)
                    // - filters are added/removed while an uncommitted local
                    //   query exists (e.g. selecting a country from the country
                    //   selector). In this case, we want to reset the local
                    //   query to match the global one, discarding any
                    //   uncommitted changes.
                    key={stateToSearchParams(state).toString()}
                    allTopics={eligibleTopics}
                />
                <SearchDetectedFilters
                    eligibleRegionNames={eligibleRegionNames}
                />
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
