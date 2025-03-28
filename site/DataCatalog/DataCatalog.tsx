import React, { useEffect, useMemo, useReducer, useState } from "react"
import { TagGraphRoot, Url } from "@ourworldindata/utils"
import algoliasearch, { SearchClient } from "algoliasearch"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import {
    analytics,
    checkShouldShowRibbonView,
    DataCatalogCache,
    DataCatalogRibbonResult,
    DataCatalogSearchResult,
    getCountryData,
    queryDataInsights,
    queryRibbons,
    querySearch,
    syncDataCatalogURL,
} from "./DataCatalogUtils.js"
import {
    dataCatalogStateToUrl,
    getInitialDatacatalogState,
    urlToDataCatalogState,
    dataCatalogReducer,
    DataCatalogState,
    createActions,
    CatalogComponentId,
} from "./DataCatalogState.js"
import { TopicsRefinementListWrapper } from "./TopicsRefinementListWrapper.js"
import { DataCatalogRibbonView } from "./DataCatalogRibbonView.js"
import { DataCatalogResults } from "./DataCatalogResults.js"
import { AppliedTopicFiltersList } from "./AppliedTopicFiltersList.js"
import { DataCatalogSearchbar } from "./DataCatalogSearchbar.js"
import { DataCatalogDataInsights } from "./DataCatalogDataInsights.js"
import { DataCatalogSettings } from "./DataCatalogSettings.js"
import { DataCatalogHighlights } from "./DataCatalogHighlights.js"

export const DataCatalog = ({
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
        pages: new Map(),
    })
    const AREA_NAMES = useMemo(
        () => tagGraph.children.map((child) => child.name),
        [tagGraph]
    )
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

            const pages = await queryDataInsights(searchClient, state)

            setCache((prevCache) => ({
                ...prevCache,
                [cacheKey]: prevCache[cacheKey].set(stateAsUrl, results as any),
                pages: prevCache.pages.set(stateAsUrl, pages),
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

    // Components that can be reordered and toggled
    const componentMap: Record<CatalogComponentId, JSX.Element> = {
        [CatalogComponentId.APPLIED_FILTERS]: (
            <AppliedTopicFiltersList
                topics={state.topics}
                removeTopic={actions.removeTopic}
            />
        ),
        [CatalogComponentId.TOPICS_REFINEMENT]: (
            <TopicsRefinementListWrapper
                topics={state.topics}
                results={currentResults}
                addTopic={actions.addTopic}
            />
        ),
        [CatalogComponentId.DATA_INSIGHTS]: (
            <DataCatalogDataInsights
                results={cache["pages"].get(stateAsUrl)}
                componentCount={state.componentCount}
                setComponentCount={actions.setComponentCount}
            />
        ),
        [CatalogComponentId.HIGHLIGHTS]: (
            <DataCatalogHighlights
                results={currentResults}
                selectedCountries={selectedCountries}
                componentCount={state.componentCount}
            />
        ),
        [CatalogComponentId.RESULTS]: shouldShowRibbons ? (
            <DataCatalogRibbonView
                addTopic={actions.addTopic}
                isLoading={isLoading}
                results={currentResults as DataCatalogRibbonResult[]}
                selectedCountries={selectedCountries}
                topics={state.topics}
                style={state.componentStyles[CatalogComponentId.RESULTS]}
            />
        ) : (
            <DataCatalogResults
                isLoading={isLoading}
                results={currentResults as DataCatalogSearchResult}
                selectedCountries={selectedCountries}
                setPage={actions.setPage}
                style={state.componentStyles[CatalogComponentId.RESULTS]}
            />
        ),
    }

    return (
        <>
            <div className="data-catalog-header span-cols-14 grid grid-cols-12-full-width">
                <div className="data-catalog-search-controls-container span-cols-12 col-start-2">
                    <DataCatalogSearchbar
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
                {!state.componentVisibility[
                    CatalogComponentId.APPLIED_FILTERS
                ] && (
                    <AppliedTopicFiltersList
                        topics={state.topics}
                        removeTopic={actions.removeTopic}
                    />
                )}
            </div>

            {/* Render components according to the configured order and visibility */}
            {state.componentOrder
                .filter((id) => state.componentVisibility[id])
                .map((id) => (
                    <React.Fragment key={id}>{componentMap[id]}</React.Fragment>
                ))}

            <DataCatalogSettings
                componentOrder={state.componentOrder}
                componentVisibility={state.componentVisibility}
                updateComponentOrder={actions.updateComponentOrder}
                toggleComponentVisibility={actions.toggleComponentVisibility}
                componentCount={state.componentCount}
                setComponentCount={actions.setComponentCount}
                componentStyles={state.componentStyles}
                setComponentStyle={actions.setComponentStyle}
            />
        </>
    )
}

export function DataCatalogInstantSearchWrapper({
    tagGraph,
}: {
    tagGraph: TagGraphRoot
}) {
    const searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
    const initialState = getInitialDatacatalogState()

    return (
        <DataCatalog
            initialState={initialState}
            tagGraph={tagGraph}
            searchClient={searchClient}
        />
    )
}
