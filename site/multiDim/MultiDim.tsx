import { useCallback, useEffect, useRef, useState } from "react"
import * as Sentry from "@sentry/react"
import { Grapher, GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import {
    extractMultiDimChoicesFromSearchParams,
    GrapherQueryParams,
    MultiDimDataPageConfig,
    MultiDimDimensionChoices,
} from "@ourworldindata/utils"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../../settings/clientSettings.js"
import { useElementBounds } from "../hooks.js"
import { cachedGetGrapherConfigByUuid } from "./api.js"
import { MultiDimSettingsPanel } from "./MultiDimDataPageSettingsPanel.js"

const baseGrapherConfig: GrapherProgrammaticInterface = {
    bakedGrapherURL: BAKED_GRAPHER_URL,
    adminBaseUrl: ADMIN_BASE_URL,
    dataApiUrl: DATA_API_URL,
    isEmbeddedInAnOwidPage: true,
}

export default function MultiDim({
    config,
    localGrapherConfig,
    queryStr,
}: {
    config: MultiDimDataPageConfig
    localGrapherConfig: GrapherProgrammaticInterface
    queryStr: string
}) {
    const grapherRef = useRef<Grapher>(null)
    const grapherContainerRef = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(grapherContainerRef)
    const [manager, setManager] = useState({
        ...localGrapherConfig.manager,
    })
    const [settings, setSettings] = useState(() => {
        const choices = extractMultiDimChoicesFromSearchParams(
            new URLSearchParams(queryStr),
            config
        )
        return config.filterToAvailableChoices(choices).selectedChoices
    })

    const handleSettingsChange = useCallback(
        (settings: MultiDimDimensionChoices) => {
            setSettings(
                config.filterToAvailableChoices(settings).selectedChoices
            )
        },
        [config]
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
        const editUrl =
            variables?.length === 1
                ? `variables/${variables[0].id}/config`
                : undefined
        setManager((prev) => ({ ...prev, editUrl }))

        const newGrapherParams: GrapherQueryParams = {
            ...grapher.changedParams,
            tab: grapher.mapGrapherTabToQueryParam(grapher.activeTab),
            ...settings,
        }

        cachedGetGrapherConfigByUuid(newView.fullConfigId, false)
            .then((viewGrapherConfig) => {
                if (ignoreFetchedData) return
                const grapherConfig = {
                    ...viewGrapherConfig,
                    ...localGrapherConfig,
                    ...baseGrapherConfig,
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
    }, [config, localGrapherConfig, settings])

    return (
        <>
            <MultiDimSettingsPanel
                className="multi-dim-settings"
                config={config}
                settings={settings}
                onChange={handleSettingsChange}
            />
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
        </>
    )
}
