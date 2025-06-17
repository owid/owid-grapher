import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as Sentry from "@sentry/react"
import {
    Grapher,
    GrapherAnalytics,
    GrapherProgrammaticInterface,
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
import { MultiDimSettingsPanel } from "./MultiDimDataPageSettingsPanel.js"
import { useBaseGrapherConfig } from "./hooks.js"

const analytics = new GrapherAnalytics()

export default function MultiDim({
    config,
    localGrapherConfig,
    slug,
    queryStr,
    archivedChartInfo,
}: {
    config: MultiDimDataPageConfig
    localGrapherConfig?: GrapherProgrammaticInterface
    slug: string | null
    queryStr: string
    archivedChartInfo?: ArchiveContext
}) {
    const grapherRef = useRef<Grapher>(null)
    const grapherContainerRef = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(grapherContainerRef)
    const additionalConfig = useMemo(
        () => ({ archivedChartInfo, isEmbeddedInAnOwidPage: true }),
        [archivedChartInfo]
    )
    const baseGrapherConfig = useBaseGrapherConfig(additionalConfig)
    const [manager, setManager] = useState({
        ...localGrapherConfig?.manager,
    })
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
            if (slug) analytics.logGrapherView(slug, { view: selectedChoices })
        },
        [config, slug]
    )

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
        setManager((prev) => ({
            ...prev,
            analyticsContext: {
                mdimSlug: slug ?? undefined,
                mdimView: settings,
            },
            adminEditPath,
            adminCreateNarrativeChartPath: `narrative-charts/create?type=multiDim&chartConfigId=${newView.fullConfigId}`,
        }))

        const newGrapherParams: GrapherQueryParams = {
            ...grapher.changedParams,
            // If the grapher has data preserve the active tab in the new view,
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

        cachedGetGrapherConfigByUuid(newView.fullConfigId, false, assetMap)
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
                grapher.downloadData()
                grapher.populateFromQueryParams(newGrapherParams)
            })
            .catch(Sentry.captureException)
        return () => {
            ignoreFetchedData = true
        }
    }, [
        config,
        localGrapherConfig,
        searchParams,
        settings,
        slug,
        archivedChartInfo,
        baseGrapherConfig,
    ])

    return (
        <div className="multi-dim-container">
            {hasControls && (
                <MultiDimSettingsPanel
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
                    ref={grapherRef}
                    {...baseGrapherConfig}
                    bounds={bounds}
                    manager={manager}
                    queryStr={queryStr}
                />
            </div>
        </div>
    )
}
