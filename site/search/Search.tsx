import { TagGraphRoot, TagGraphNode } from "@ourworldindata/types"
import { Url } from "@ourworldindata/utils"
import { SearchClient } from "algoliasearch"
import { useReducer, useMemo, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { DataCatalogRibbonView } from "./DataCatalogRibbonView.js"
import { DataCatalogResults } from "./DataCatalogResults.js"
import { Searchbar } from "./Searchbar.js"
import { SearchResultType } from "./SearchResultTypeToggle.js"
import { SearchTopicsRefinementList } from "./SearchTopicsRefinementList.js"
import {
    searchReducer,
    createActions,
    searchStateToUrl,
    urlToSearchState,
} from "./searchState.js"
import {
    DataCatalogRibbonResult,
    DataCatalogSearchResult,
    SearchState,
    FilterType,
    ResultType,
} from "./searchTypes.js"
import {
    checkShouldShowRibbonView,
    getCountryData,
    syncDataCatalogURL,
    getFilterNamesOfType,
    queryDataCatalogRibbons,
    queryDataCatalogSearch,
} from "./searchUtils.js"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { searchQueryKeys } from "./searchQueryKeys.js"
import { AsDraft } from "../AsDraft/AsDraft.js"

const analytics = new SiteAnalytics()

export const Search = ({
    initialState,
    tagGraph,
    searchClient,
}: {
    initialState: SearchState
    tagGraph: TagGraphRoot
    searchClient: SearchClient
}) => {
    const [state, dispatch] = useReducer(searchReducer, initialState)
    const actions = useMemo(() => createActions(dispatch), [dispatch])

    const AREA_NAMES = useMemo(
        () => tagGraph.children.map((child) => child.name),
        [tagGraph]
    )

    const ALL_TOPICS = useMemo(() => {
        function getAllTopics(node: TagGraphNode): Set<string> {
            return node.children.reduce((acc, child) => {
                if (child.isTopic) {
                    acc.add(child.name)
                }
                if (child.children.length) {
                    const topics = getAllTopics(child)
                    topics.forEach((topic) => acc.add(topic))
                }
                return acc
            }, new Set<string>())
        }
        return Array.from(getAllTopics(tagGraph))
    }, [tagGraph])

    const selectedTopics = useMemo(
        () => getFilterNamesOfType(state.filters, FilterType.TOPIC),
        [state.filters]
    )

    const selectedCountryNames = useMemo(
        () => getFilterNamesOfType(state.filters, FilterType.COUNTRY),
        [state.filters]
    )

    const shouldShowRibbons = useMemo(
        () =>
            checkShouldShowRibbonView(state.query, selectedTopics, AREA_NAMES),
        [state.query, selectedTopics, AREA_NAMES]
    )

    const selectedCountries = useMemo(
        () => getCountryData(selectedCountryNames),
        [selectedCountryNames]
    )

    const searchQuery = useQuery<DataCatalogSearchResult, Error>({
        queryKey: searchQueryKeys.search(state),
        queryFn: () => queryDataCatalogSearch(searchClient, state),
        enabled: !shouldShowRibbons,
    })

    const ribbonsQuery = useQuery<DataCatalogRibbonResult[], Error>({
        queryKey: searchQueryKeys.ribbons(state), // the tagGraph can only change on page load, so we don't need to include it in the key
        queryFn: () => queryDataCatalogRibbons(searchClient, state, tagGraph),
        enabled: shouldShowRibbons,
    })

    const stateAsUrl = searchStateToUrl(state)

    useEffect(() => {
        const url = Url.fromURL(window.location.href)
        const urlState = urlToSearchState(url)
        actions.setState(urlState)
    }, [actions])

    useEffect(() => {
        // Reconstructing state from the `stateAsUrl` serialization to avoid a `state` dependency in this effect,
        // which would cause it to run on every state change (even no-ops)
        const url = Url.fromURL(stateAsUrl)
        const state = urlToSearchState(url)
        analytics.logDataCatalogSearch(state)
    }, [stateAsUrl])

    useEffect(() => {
        syncDataCatalogURL(stateAsUrl)
    }, [stateAsUrl])

    useEffect(() => {
        const handlePopState = () => {
            const url = Url.fromURL(window.location.href)
            actions.setState(urlToSearchState(url))
        }
        window.addEventListener("popstate", handlePopState)
        return () => {
            window.removeEventListener("popstate", handlePopState)
        }
    }, [actions])

    return (
        <>
            <div className="data-catalog-header span-cols-14 grid grid-cols-12-full-width">
                <header className="data-catalog-heading span-cols-12 col-start-2">
                    <h1 className="h1-semibold">Data Catalog</h1>
                    <p className="body-2-regular">
                        Search for a specific chart, or browse all our charts by
                        area and topic.
                    </p>
                </header>
                <div className="data-catalog-search-controls-container span-cols-12 col-start-2">
                    <Searchbar
                        allTopics={ALL_TOPICS}
                        filters={state.filters}
                        addCountry={actions.addCountry}
                        removeCountry={actions.removeCountry}
                        addTopic={actions.addTopic}
                        removeTopic={actions.removeTopic}
                        query={state.query}
                        requireAllCountries={state.requireAllCountries}
                        setQuery={actions.setQuery}
                        toggleRequireAllCountries={
                            actions.toggleRequireAllCountries
                        }
                        reset={actions.reset}
                    />
                </div>
            </div>
            <SearchTopicsRefinementList
                topics={selectedTopics}
                facets={
                    shouldShowRibbons
                        ? Object.fromEntries(
                              (ribbonsQuery.data as DataCatalogRibbonResult[])
                                  ?.sort((a, b) => b.nbHits - a.nbHits)
                                  ?.map((r) => [r.title, r.nbHits]) || []
                          )
                        : (searchQuery.data as DataCatalogSearchResult)?.facets
                              ?.tags
                }
                addTopic={actions.addTopic}
            />
            <AsDraft
                className="col-start-11 span-cols-3 as-draft--align-self-start"
                name="Search result type"
            >
                <SearchResultType
                    value={state.resultType}
                    onChange={actions.setResultType}
                />
            </AsDraft>
            {shouldShowRibbons ? (
                <DataCatalogRibbonView
                    addTopic={actions.addTopic}
                    isLoading={ribbonsQuery.isLoading}
                    results={ribbonsQuery.data}
                    selectedCountries={selectedCountries}
                    tagGraph={tagGraph}
                    topics={selectedTopics}
                />
            ) : (
                <DataCatalogResults
                    isLoading={searchQuery.isLoading}
                    results={searchQuery.data}
                    selectedCountries={selectedCountries}
                    setPage={actions.setPage}
                />
            )}
        </>
    )
}
