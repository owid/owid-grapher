import { TagGraphRoot, TagGraphNode } from "@ourworldindata/types"
import { Url } from "@ourworldindata/utils"
import { SearchClient } from "algoliasearch"
import { useReducer, useState, useMemo, useEffect } from "react"
import { DataCatalogRibbonView } from "./DataCatalogRibbonView.js"
import { AppliedTopicFiltersList } from "./AppliedTopicFiltersList.js"
import { DataCatalogResults } from "./DataCatalogResults.js"
import { Searchbar } from "./Searchbar.js"
import {
    DataCatalogState,
    dataCatalogReducer,
    createActions,
    dataCatalogStateToUrl,
    urlToDataCatalogState,
} from "./searchState.js"
import {
    DataCatalogCache,
    DataCatalogRibbonResult,
    DataCatalogSearchResult,
} from "./searchTypes.js"
import {
    analytics,
    checkShouldShowRibbonView,
    getCountryData,
    queryRibbons,
    querySearch,
    syncDataCatalogURL,
} from "./searchUtils.js"

export const Search = ({
    initialState,
    tagGraph,
    searchClient,
}: {
    initialState: DataCatalogState
    tagGraph: TagGraphRoot
    searchClient: SearchClient
}) => {
    const [state, dispatch] = useReducer(dataCatalogReducer, initialState)
    const actions = createActions(dispatch)
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
                if (child.children.length) {
                    const topics = getAllTopics(child)
                    return new Set([...acc, ...topics])
                }
                if (child.isTopic) {
                    acc.add(child.name)
                }
                return acc
            }, new Set<string>())
        }
        return Array.from(getAllTopics(tagGraph))
    }, [tagGraph])

    const shouldShowRibbons = useMemo(
        () => checkShouldShowRibbonView(state.query, state.topics, AREA_NAMES),
        [state.query, state.topics, AREA_NAMES]
    )
    const selectedCountries = useMemo(
        () => getCountryData(state.selectedCountryNames),
        [state.selectedCountryNames]
    )

    const stateAsUrl = dataCatalogStateToUrl(state)
    const cacheKey = shouldShowRibbons ? "ribbons" : "search"
    const currentResults = cache[cacheKey].get(stateAsUrl)

    useEffect(() => {
        // Reconstructing state from the `stateAsUrl` serialization to avoid a `state` dependency in this effect,
        // which would cause it to run on every state change (even no-ops)
        const url = Url.fromURL(stateAsUrl)
        const state = urlToDataCatalogState(url)
        analytics.logDataCatalogSearch(state)
    }, [stateAsUrl])

    useEffect(() => {
        async function fetchData() {
            const results = shouldShowRibbons
                ? await queryRibbons(searchClient, state, tagGraph)
                : await querySearch(searchClient, state)
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
            actions.setState(urlToDataCatalogState(url))
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
                        selectedTopics={state.topics}
                        addCountry={actions.addCountry}
                        addTopic={actions.addTopic}
                        query={state.query}
                        removeCountry={actions.removeCountry}
                        requireAllCountries={state.requireAllCountries}
                        selectedCountries={selectedCountries}
                        selectedCountryNames={state.selectedCountryNames}
                        setQuery={actions.setQuery}
                        toggleRequireAllCountries={
                            actions.toggleRequireAllCountries
                        }
                    />
                </div>
            </div>
            <AppliedTopicFiltersList
                topics={state.topics}
                removeTopic={actions.removeTopic}
            />
            {shouldShowRibbons ? (
                <DataCatalogRibbonView
                    addTopic={actions.addTopic}
                    isLoading={isLoading}
                    removeTopic={actions.removeTopic}
                    results={currentResults as DataCatalogRibbonResult[]}
                    selectedCountries={selectedCountries}
                    tagGraph={tagGraph}
                    topics={state.topics}
                />
            ) : (
                <DataCatalogResults
                    addTopic={actions.addTopic}
                    isLoading={isLoading}
                    results={currentResults as DataCatalogSearchResult}
                    selectedCountries={selectedCountries}
                    setPage={actions.setPage}
                    topics={state.topics}
                />
            )}
        </>
    )
}
