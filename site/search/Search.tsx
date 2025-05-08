import { TagGraphRoot, TagGraphNode } from "@ourworldindata/types"
import { Url } from "@ourworldindata/utils"
import { SearchClient } from "algoliasearch"
import { useReducer, useState, useMemo, useEffect } from "react"
import { DataCatalogRibbonView } from "./DataCatalogRibbonView.js"
import { DataCatalogResults } from "./DataCatalogResults.js"
import { Searchbar } from "./Searchbar.js"
import {
    searchReducer,
    createActions,
    searchStateToUrl,
    urlToSearchState,
} from "./searchState.js"
import {
    DataCatalogCache,
    DataCatalogRibbonResult,
    DataCatalogSearchResult,
    SearchState,
    FilterType,
} from "./searchTypes.js"
import {
    checkShouldShowRibbonView,
    getCountryData,
    queryDataCatalogRibbons,
    queryDataCatalogSearch,
    syncDataCatalogURL,
    getFilterNamesOfType,
} from "./searchUtils.js"
import { SiteAnalytics } from "../SiteAnalytics.js"

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
    const [isLoading, setIsLoading] = useState(false)
    const [cache, setCache] = useState<DataCatalogCache>({
        ribbons: new Map(),
        search: new Map(),
    })
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

    const stateAsUrl = searchStateToUrl(state)
    const cacheKey = shouldShowRibbons ? "ribbons" : "search"
    const currentResults = cache[cacheKey].get(stateAsUrl)

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
        async function fetchData() {
            const results = shouldShowRibbons
                ? await queryDataCatalogRibbons(searchClient, state, tagGraph)
                : await queryDataCatalogSearch(searchClient, state)
            setCache((prevCache) => ({
                ...prevCache,
                [cacheKey]: prevCache[cacheKey].set(stateAsUrl, results as any),
            }))
        }

        syncDataCatalogURL(stateAsUrl)
        if (cache[cacheKey].has(stateAsUrl)) return

        setIsLoading(true)
        void fetchData().then(() => setIsLoading(false))
        return () => setIsLoading(false)
    }, [
        state,
        searchClient,
        shouldShowRibbons,
        tagGraph,
        stateAsUrl,
        cacheKey,
        cache,
    ])

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
            {shouldShowRibbons ? (
                <DataCatalogRibbonView
                    addTopic={actions.addTopic}
                    isLoading={isLoading}
                    results={currentResults as DataCatalogRibbonResult[]}
                    selectedCountries={selectedCountries}
                    tagGraph={tagGraph}
                    topics={selectedTopics}
                />
            ) : (
                <DataCatalogResults
                    addTopic={actions.addTopic}
                    isLoading={isLoading}
                    results={currentResults as DataCatalogSearchResult}
                    selectedCountries={selectedCountries}
                    setPage={actions.setPage}
                    topics={selectedTopics}
                />
            )}
        </>
    )
}
