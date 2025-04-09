import React, { useEffect, useMemo, useReducer, useState } from "react"
import { TagGraphRoot, Url } from "@ourworldindata/utils"
import algoliasearch, { SearchClient } from "algoliasearch"
import cx from "classnames"
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
    getFiltersOfType,
} from "./DataCatalogUtils.js"
import {
    dataCatalogStateToUrl,
    getInitialDatacatalogState,
    urlToDataCatalogState,
    dataCatalogReducer,
    DataCatalogState,
    createActions,
    CatalogComponentId,
    DEFAULT_COMPONENTS,
    CatalogContentType,
    CatalogFilterType,
} from "./DataCatalogState.js"
import { TopicsRefinementListWrapper } from "./TopicsRefinementListWrapper.js"
import { DataCatalogRibbonView } from "./DataCatalogRibbonView.js"
import { DataCatalogResults } from "./DataCatalogResults.js"
import { DataCatalogAppliedFilters } from "./DataCatalogAppliedFilters.js"
import { DataCatalogSearchbar } from "./DataCatalogSearchbar.js"
import { DataCatalogDataInsights } from "./DataCatalogDataInsights.js"
import { DataCatalogSettings } from "./DataCatalogSettings.js"
import { DataCatalogHighlights } from "./DataCatalogHighlights.js"
import { ScrollDirection, useScrollDirection } from "../hooks.js"
import { ContentTypeToggle } from "./ContentTypeToggle.js"
import { DataCatalogFuzzyMatcher } from "./DataCatalogFuzzyMatcher.js"

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
    const scrollDirection = useScrollDirection()
    const AREA_NAMES = useMemo(
        () => tagGraph.children.map((child) => child.name),
        [tagGraph]
    )

    // Extract country names and topics from filters
    const selectedCountryNames = useMemo(
        () => getFiltersOfType(state, CatalogFilterType.COUNTRY),
        [state]
    )

    const topics = useMemo(
        () => getFiltersOfType(state, CatalogFilterType.TOPIC),
        [state]
    )

    const shouldShowRibbons = useMemo(
        () => checkShouldShowRibbonView(state.query, topics, AREA_NAMES),
        [state.query, topics, AREA_NAMES]
    )

    const selectedCountries = useMemo(
        () => getCountryData(selectedCountryNames),
        [selectedCountryNames]
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
        [CatalogComponentId.CONTENT_TYPE_TOGGLE]: (
            <ContentTypeToggle
                contentTypeFilter={state.contentTypeFilter}
                setContentTypeFilter={actions.setContentTypeFilter}
            />
        ),
        [CatalogComponentId.APPLIED_FILTERS]: (
            <DataCatalogAppliedFilters
                filters={state.filters}
                removeFilter={actions.removeFilter}
            />
        ),
        [CatalogComponentId.FUZZY_MATCHER]: (
            <DataCatalogFuzzyMatcher
                addCountry={actions.addCountry}
                addTopic={actions.addTopic}
                minQueryLength={state.minQueryLength}
            />
        ),
        [CatalogComponentId.TOPICS_REFINEMENT]: (
            <TopicsRefinementListWrapper
                topics={topics}
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
                topics={topics}
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

    // Helper function to check if a component should be shown based on content type
    const shouldShowComponent = (id: CatalogComponentId): boolean => {
        // Check if component is visible
        if (!state.componentVisibility[id]) return false

        // Always show if filter is set to ALL
        if (state.contentTypeFilter === CatalogContentType.ALL) return true

        // Find component config
        const component = DEFAULT_COMPONENTS.find((c) => c.id === id)

        // If component has no type specified or type includes the selected filter, show it
        return (
            !component?.type || component.type.includes(state.contentTypeFilter)
        )
    }

    return (
        <>
            <div
                className={cx(
                    "data-catalog-header span-cols-14 grid grid-cols-12-full-width",
                    {
                        sticky: state.isStickyHeader, // Only apply sticky if enabled in settings
                        visible:
                            scrollDirection === ScrollDirection.Up &&
                            state.isStickyHeader,
                        hidden:
                            scrollDirection === ScrollDirection.Down &&
                            state.isStickyHeader,
                    }
                )}
            >
                <div className="data-catalog-search-controls-container span-cols-12 col-start-2">
                    <DataCatalogSearchbar
                        addFilter={actions.addFilter}
                        query={state.query}
                        removeFilter={actions.removeFilter}
                        requireAllCountries={state.requireAllCountries}
                        selectedCountries={selectedCountries}
                        selectedCountryNames={selectedCountryNames}
                        setQuery={actions.setQuery}
                        toggleRequireAllCountries={
                            actions.toggleRequireAllCountries
                        }
                        searchRelaxationMode={state.searchRelaxationMode}
                        queryType={state.queryType}
                        typoTolerance={state.typoTolerance}
                        minQueryLength={state.minQueryLength}
                        filters={state.filters}
                        enableCombinedFilters={state.enableCombinedFilters}
                    />
                </div>
            </div>

            {/* Render components according to component order, visibility and type filter */}
            {state.componentOrder.filter(shouldShowComponent).map((id) => (
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
                isStickyHeader={state.isStickyHeader}
                toggleStickyHeader={actions.toggleStickyHeader}
                searchRelaxationMode={state.searchRelaxationMode}
                setSearchRelaxationMode={actions.setSearchRelaxationMode}
                queryType={state.queryType}
                setQueryType={actions.setQueryType}
                typoTolerance={state.typoTolerance}
                setTypoTolerance={actions.setTypoTolerance}
                minQueryLength={state.minQueryLength}
                setMinQueryLength={actions.setMinQueryLength}
                enableCombinedFilters={state.enableCombinedFilters}
                toggleCombinedFilters={actions.toggleCombinedFilters}
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
