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
    loadVariableDataAndMetadata,
    useMaybeGlobalGrapherStateRef,
    GuidedChartContext,
} from "@ourworldindata/grapher"
import {
    extractMultiDimChoicesFromSearchParams,
    GRAPHER_TAB_QUERY_PARAMS,
    GrapherQueryParams,
    MultiDimDataPageConfig,
    MultiDimDimensionChoices,
} from "@ourworldindata/utils"
import { ArchiveContext } from "@ourworldindata/types"
import { useElementBounds } from "../hooks.js"
import { cachedGetGrapherConfigByUuid } from "./api.js"
import MultiDimEmbedSettingsPanel from "./MultiDimEmbedSettingsPanel.js"
import { useBaseGrapherConfig, useMultiDimAnalytics } from "./hooks.js"
import { DATA_API_URL } from "../../settings/clientSettings.js"

export default function MultiDim({
    config,
    localGrapherConfig,
    slug,
    queryStr,
    archivedChartInfo,
    isPreviewing,
}: {
    config: MultiDimDataPageConfig
    localGrapherConfig?: GrapherProgrammaticInterface
    slug: string | null
    queryStr: string
    archivedChartInfo?: ArchiveContext
    isPreviewing?: boolean
}) {
    const manager = useRef(localGrapherConfig?.manager ?? {})
    const grapherRef = useMaybeGlobalGrapherStateRef({
        manager: manager.current,
        queryStr,
        additionalDataLoaderFn: (varId: number) =>
            loadVariableDataAndMetadata(varId, DATA_API_URL, {
                noCache: isPreviewing,
            }),
        isConfigReady: false,
    })

    const grapherDataLoader = useRef(
        getCachingInputTableFetcher(DATA_API_URL, undefined, isPreviewing)
    )
    const grapherContainerRef = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(grapherContainerRef)
    const additionalConfig = useMemo(
        () => ({ archivedChartInfo, isEmbeddedInAnOwidPage: true }),
        [archivedChartInfo]
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

    const handleSettingsChange = useCallback(
        (settings: MultiDimDimensionChoices) => {
            const { selectedChoices } =
                config.filterToAvailableChoices(settings)
            setSettings(selectedChoices)
        },
        [config]
    )

    useMultiDimAnalytics(slug, config, settings)

    // Register with GuidedChartContext for guided chart link support
    const guidedChartContext = useContext(GuidedChartContext)
    const hasRegistered = useRef(false)
    useEffect(() => {
        if (guidedChartContext?.registerMultiDim && !hasRegistered.current) {
            guidedChartContext.registerMultiDim({
                config,
                onSettingsChange: handleSettingsChange,
                grapherContainerRef: grapherContainerRef,
            })
            hasRegistered.current = true
        }
    }, [guidedChartContext, config, handleSettingsChange])

    useEffect(() => {
        // Prevent a race condition from setting incorrect data.
        // https://react.dev/learn/synchronizing-with-effects#fetching-data
        let ignoreFetchedData = false

        const grapher = grapherRef.current
        if (!grapher) return

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

        const newGrapherParams: GrapherQueryParams = {
            ...grapher.changedParams,
            // If the grapher has data, preserve the active tab in the new view,
            // otherwise use the tab from the URL.
            tab: grapher.hasData
                ? grapher.mapGrapherTabToQueryParam(grapher.activeTab)
                : (searchParams.get("tab") ?? undefined),
            ...settings,
        }

        // reset map state if switching to a chart
        if (newGrapherParams.tab !== GRAPHER_TAB_QUERY_PARAMS.map) {
            newGrapherParams.globe = "0"
            newGrapherParams.mapSelect = ""
        }

        const assetMap =
            archivedChartInfo?.type === "archive-page"
                ? archivedChartInfo.assets.runtime
                : undefined

        const previousTab = grapher.activeTab

        cachedGetGrapherConfigByUuid(
            newView.fullConfigId,
            Boolean(isPreviewing),
            assetMap
        )
            .then((viewGrapherConfig) => {
                if (ignoreFetchedData) return
                const grapherConfig = {
                    ...viewGrapherConfig,
                    ...localGrapherConfig,
                    ...baseGrapherConfig,
                }
                if (slug) {
                    grapherConfig.slug = slug // Needed for the URL used for sharing.
                }
                grapher.setAuthoredVersion(grapherConfig)
                grapher.reset()
                grapher.updateFromObject(grapherConfig)
                grapher.isConfigReady = true
                void grapherDataLoader
                    .current(
                        grapherConfig.dimensions ?? [],
                        grapherConfig.selectedEntityColors
                    )
                    .then((table) => {
                        if (table) {
                            grapher.inputTable = table
                        }
                    })
                grapher.populateFromQueryParams(newGrapherParams)

                // When switching between mdim views, we usually preserve the tab.
                // However, if the new chart doesn't support the previously selected tab,
                // Grapher automatically switches to a supported one. In such cases,
                // we call onChartSwitching to make adjustments that ensure the new view
                // is sensible (e.g. updating the time selection when switching from a
                // single-time chart like a discrete bar chart to a multi-time chart like
                // a line chart).
                const currentTab = grapher.activeTab
                if (previousTab !== currentTab)
                    grapher.onChartSwitching(previousTab, currentTab)
            })
            .catch(Sentry.captureException)
        return () => {
            ignoreFetchedData = true
        }
    }, [
        config,
        isPreviewing,
        localGrapherConfig,
        searchParams,
        settings,
        slug,
        archivedChartInfo,
        baseGrapherConfig,
        manager,
        grapherRef,
    ])

    useEffect(() => {
        if (grapherRef.current) {
            grapherRef.current.externalBounds = bounds
        }
    }, [bounds, grapherRef])

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
                    grapherState={grapherRef.current}
                    {...baseGrapherConfig}
                />
            </div>
        </div>
    )
}
