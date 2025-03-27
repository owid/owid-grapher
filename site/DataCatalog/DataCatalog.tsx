import { useEffect, useMemo, useReducer, useState } from "react"
import { TagGraphRoot, Url } from "@ourworldindata/utils"
import algoliasearch, { SearchClient } from "algoliasearch"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
// Update MUI imports to include Fab
import { Drawer, IconButton, Box, Typography, Fab } from "@mui/material"
import SettingsIcon from "@mui/icons-material/Settings"
import CloseIcon from "@mui/icons-material/Close"
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
} from "./DataCatalogState.js"
import { TopicsRefinementListWrapper } from "./TopicsRefinementListWrapper.js"
import { DataCatalogRibbonView } from "./DataCatalogRibbonView.js"
import { DataCatalogResults } from "./DataCatalogResults.js"
import { AppliedTopicFiltersList } from "./AppliedTopicFiltersList.js"
import { DataCatalogSearchbar } from "./DataCatalogSearchbar.js"
import { DataCatalogDataInsights } from "./DataCatalogDataInsights.js"

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
    // Add state for drawer
    const [drawerOpen, setDrawerOpen] = useState(false)
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
                    <DataCatalogSearchbar
                        addCountry={actions.addCountry}
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
                    {/* Remove the inline settings button */}
                </div>
            </div>

            {/* Add floating action button for settings */}
            <Fab
                color="primary"
                aria-label="settings"
                onClick={() => setDrawerOpen(true)}
                sx={{
                    position: "fixed",
                    bottom: 24,
                    right: 24,
                    zIndex: 1000,
                }}
            >
                <SettingsIcon />
            </Fab>

            {/* Drawer component remains unchanged */}
            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
            >
                <Box sx={{ width: 300, p: 3 }}>
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 2,
                        }}
                    >
                        <Typography variant="h6">Settings</Typography>
                        <IconButton onClick={() => setDrawerOpen(false)}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                    <Box>{/* Drawer content will go here */}</Box>
                </Box>
            </Drawer>

            <AppliedTopicFiltersList
                topics={state.topics}
                removeTopic={actions.removeTopic}
            />

            <TopicsRefinementListWrapper
                topics={state.topics}
                results={currentResults}
                addTopic={actions.addTopic}
            />

            <DataCatalogDataInsights results={cache["pages"].get(stateAsUrl)} />

            {shouldShowRibbons ? (
                <DataCatalogRibbonView
                    addTopic={actions.addTopic}
                    isLoading={isLoading}
                    results={currentResults as DataCatalogRibbonResult[]}
                    selectedCountries={selectedCountries}
                    topics={state.topics}
                />
            ) : (
                <DataCatalogResults
                    isLoading={isLoading}
                    results={currentResults as DataCatalogSearchResult}
                    selectedCountries={selectedCountries}
                    setPage={actions.setPage}
                />
            )}
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
