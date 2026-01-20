import { runInAction } from "mobx"
import {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import * as Sentry from "@sentry/react"
import {
    getCachingInputTableFetcher,
    Grapher,
    GrapherProgrammaticInterface,
    useMaybeGlobalGrapherStateRef,
    GuidedChartContext,
} from "@ourworldindata/grapher"
import {
    extractMultiDimChoicesFromSearchParams,
    GRAPHER_TAB_QUERY_PARAMS,
    GrapherQueryParams,
    loadCatalogVariableData,
    MultiDimDataPageConfig,
    MultiDimDimensionChoices,
} from "@ourworldindata/utils"
import { ArchiveContext } from "@ourworldindata/types"
import { useElementBounds } from "../hooks.js"
import { cachedGetGrapherConfigByUuid } from "./api.js"
import MultiDimEmbedSettingsPanel from "./MultiDimEmbedSettingsPanel.js"
import { useBaseGrapherConfig, useMultiDimAnalytics } from "./hooks.js"
import {
    BAKED_GRAPHER_URL,
    CATALOG_URL,
    DATA_API_URL,
} from "../../settings/clientSettings.js"

export default function MultiDim({
    config,
    localGrapherConfig,
    slug,
    queryStr,
    archiveContext,
    isPreviewing,
}: {
    config: MultiDimDataPageConfig
    localGrapherConfig?: GrapherProgrammaticInterface
    slug: string | null
    queryStr: string
    archiveContext?: ArchiveContext
    isPreviewing?: boolean
}) {
    const assetMap =
        archiveContext?.type === "archive-page"
            ? archiveContext.assets.runtime
            : undefined
    const manager = useRef(localGrapherConfig?.manager ?? {})
    const grapherStateRef = useMaybeGlobalGrapherStateRef({
        manager: manager.current,
        queryStr,
        additionalDataLoaderFn: (catalogKey) =>
            loadCatalogVariableData(catalogKey, {
                baseUrl: CATALOG_URL,
                assetMap,
            }),
        archiveContext,
        isConfigReady: false,
    })

    const grapherDataLoader = useRef(
        getCachingInputTableFetcher(DATA_API_URL, archiveContext, isPreviewing)
    )
    const grapherContainerRef = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(grapherContainerRef)
    const additionalConfig = useMemo(
        () => ({ archiveContext, isEmbeddedInAnOwidPage: true }),
        [archiveContext]
    )
    const baseGrapherConfig = useBaseGrapherConfig(additionalConfig)
    const searchParams = useMemo(
        () => new URLSearchParams(queryStr),
        [queryStr]
    )
    const hasControls = searchParams.get("hideControls") !== "true"

    const [settings, setSettings] = useState(() => {
        const choices = extractMultiDimChoicesFromSearchParams(
            searchParams,
            config
        )
        return config.filterToAvailableChoices(choices).selectedChoices
    })
    // We want to preserve the grapher tab when switching between views, except
    // when the switch happens via a guided chart link.
    const [shouldPreserveTab, setShouldPreserveTab] = useState(false)
    const [additionalQueryParams, setAdditionalQueryParams] =
        useState<GrapherQueryParams | null>(null)

    const handleBaseSettingsChange = useCallback(
        (settings: MultiDimDimensionChoices) => {
            const { selectedChoices } =
                config.filterToAvailableChoices(settings)
            setSettings(selectedChoices)
        },
        [config]
    )

    const handleSettingsChange = useCallback(
        (settings: MultiDimDimensionChoices) => {
            handleBaseSettingsChange(settings)
            setShouldPreserveTab(true)
            setAdditionalQueryParams(null)
        },
        [handleBaseSettingsChange]
    )

    const handleGuidedChartSettingsChange = useCallback(
        (
            settings: MultiDimDimensionChoices,
            queryParams: GrapherQueryParams
        ) => {
            handleBaseSettingsChange(settings)
            setShouldPreserveTab(false)
            setAdditionalQueryParams(queryParams)
        },
        [handleBaseSettingsChange]
    )

    useMultiDimAnalytics(slug, config, settings)

    // Register with GuidedChartContext for guided chart link support
    const guidedChartContext = useContext(GuidedChartContext)
    const hasRegistered = useRef(false)
    useEffect(() => {
        if (guidedChartContext?.registerMultiDim && !hasRegistered.current) {
            guidedChartContext.registerMultiDim({
                config,
                onSettingsChange: handleGuidedChartSettingsChange,
                grapherContainerRef: grapherContainerRef,
            })
            hasRegistered.current = true
        }
    }, [guidedChartContext, config, handleGuidedChartSettingsChange])

    // NOTE (Martin): We used to use `grapherState.isDataReady` here to prevent
    // an edge case race condition on a slow network from setting incorrect
    // data. However, that caused flickering when switching between guided chart
    // links, which was even worse and I didn't figure out how else to fix it
    // than to remove the `grapherState.isDataReady` usage.
    useEffect(() => {
        // Prevent a race condition from setting incorrect data.
        // https://react.dev/learn/synchronizing-with-effects#fetching-data
        let ignoreFetchedData = false

        const grapherState = grapherStateRef.current
        if (!grapherState) return

        const newView = config.findViewByDimensions(settings)
        if (!newView) {
            throw new Error(
                `No view found for dimensions: ${JSON.stringify(settings)}`
            )
        }

        const variables = newView.indicators?.["y"]
        const adminEditPath =
            variables?.length === 1
                ? `variables/${variables[0].id}/config`
                : undefined
        const analyticsContext = {
            mdimSlug: slug ?? undefined,
            mdimViewConfigId: newView.fullConfigId,
        }
        manager.current.adminEditPath = adminEditPath
        manager.current.analyticsContext = analyticsContext
        manager.current.adminCreateNarrativeChartPath = `narrative-charts/create?type=multiDim&chartConfigId=${newView.fullConfigId}`
        if (slug) manager.current.baseUrl = `${BAKED_GRAPHER_URL}/${slug}`

        const newGrapherParams: GrapherQueryParams = {
            ...grapherState.changedParams,
            ...settings,
            ...additionalQueryParams,
        }
        if (shouldPreserveTab) {
            // If the grapher has data, preserve the active tab in the new view,
            // otherwise use the tab from the URL.
            newGrapherParams.tab = grapherState.hasData
                ? grapherState.mapGrapherTabToQueryParam(grapherState.activeTab)
                : (searchParams.get("tab") ?? undefined)
        }

        // reset map state if switching to a chart
        if (newGrapherParams.tab !== GRAPHER_TAB_QUERY_PARAMS.map) {
            newGrapherParams.globe = "0"
            newGrapherParams.mapSelect = ""
        }

        const previousTab = grapherState.activeTab

        cachedGetGrapherConfigByUuid(
            newView.fullConfigId,
            Boolean(isPreviewing),
            assetMap
        )
            .then(async (viewGrapherConfig) => {
                if (ignoreFetchedData) return
                const grapherConfig = {
                    ...viewGrapherConfig,
                    ...baseGrapherConfig,
                    ...localGrapherConfig,
                }
                if (slug) {
                    grapherConfig.slug = slug // Needed for the URL used for sharing.
                }
                runInAction(() => {
                    grapherState.setAuthoredVersion(grapherConfig)
                    grapherState.reset()
                    grapherState.updateFromObject(grapherConfig)
                    grapherState.isConfigReady = true
                    grapherState.populateFromQueryParams(newGrapherParams)
                })

                await grapherDataLoader
                    .current(
                        grapherConfig.dimensions ?? [],
                        grapherConfig.selectedEntityColors
                    )
                    .then((table) => {
                        if (table) {
                            runInAction(() => {
                                grapherState.inputTable = table
                            })
                        }
                    })

                // The below code needs to run after the data has been loaded, so that it has access
                // to the table and its time range
                runInAction(() => {
                    // When switching between mdim views, we usually preserve the tab.
                    // However, if the new chart doesn't support the previously selected tab,
                    // Grapher automatically switches to a supported one. In such cases,
                    // we call onChartSwitching to make adjustments that ensure the new view
                    // is sensible (e.g. updating the time selection when switching from a
                    // single-time chart like a discrete bar chart to a multi-time chart like
                    // a line chart).
                    const currentTab = grapherState.activeTab
                    if (previousTab !== currentTab)
                        grapherState.onChartSwitching(previousTab, currentTab)
                })
            })
            .catch(Sentry.captureException)
        return () => {
            ignoreFetchedData = true
        }
    }, [
        assetMap,
        config,
        isPreviewing,
        localGrapherConfig,
        searchParams,
        settings,
        slug,
        shouldPreserveTab,
        additionalQueryParams,
        baseGrapherConfig,
        manager,
        grapherStateRef,
    ])

    useEffect(() => {
        if (grapherStateRef.current) {
            runInAction(() => {
                grapherStateRef.current.externalBounds = bounds
            })
        }
    }, [bounds, grapherStateRef])

    return (
        <div className="multi-dim-container full-width-on-mobile">
            {hasControls && (
                <MultiDimEmbedSettingsPanel
                    className="multi-dim-settings"
                    config={config}
                    settings={settings}
                    onChange={handleSettingsChange}
                />
            )}
            <div
                className="multi-dim-grapher-container"
                ref={grapherContainerRef}
            >
                <Grapher
                    grapherState={grapherStateRef.current}
                    {...baseGrapherConfig}
                />
            </div>
        </div>
    )
}
