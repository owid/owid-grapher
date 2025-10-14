import {
    GrapherInterface,
    OwidVariableDataMetadataDimensions,
    ArchiveContext,
    OwidVariableId,
} from "@ourworldindata/types"
import React from "react"
import { Grapher, GrapherProgrammaticInterface } from "./Grapher.js"
import { loadVariableDataAndMetadata } from "./loadVariable.js"
import { fetchInputTableForConfig } from "./loadGrapherTableHelpers.js"
import { legacyToCurrentGrapherQueryParams } from "./GrapherUrlMigrations.js"
import { unstable_batchedUpdates } from "react-dom"
import { Bounds } from "@ourworldindata/utils"
import { migrateGrapherConfigToLatestVersion } from "../schema/migrations/migrate.js"
import { useMaybeGlobalGrapherStateRef } from "../chart/GuidedChartUtils.js"

export interface FetchingGrapherProps {
    config?: GrapherProgrammaticInterface
    configUrl?: string
    dataApiUrl: string
    archiveContext: ArchiveContext | undefined
    queryStr?: string
    externalBounds?: Bounds
    noCache?: boolean
}

export function FetchingGrapher(
    props: FetchingGrapherProps
): React.ReactElement | null {
    // if config is not provided, fetch it from configUrl

    const [downloadedConfig, setDownloadedConfig] = React.useState<
        GrapherInterface | undefined
    >(undefined)

    const grapherState = useMaybeGlobalGrapherStateRef({
        ...props.config,
        additionalDataLoaderFn: (
            varId: OwidVariableId
        ): Promise<OwidVariableDataMetadataDimensions> =>
            loadVariableDataAndMetadata(varId, props.dataApiUrl, {
                noCache: props.noCache,
            }),
        queryStr: props.queryStr,
        bounds: props.externalBounds,
        isConfigReady: !props.configUrl,
    })

    React.useEffect(() => {
        if (props.externalBounds) {
            grapherState.current.externalBounds = props.externalBounds
        }
    }, [props.externalBounds, grapherState])

    // update grapherState when the config from props changes
    React.useEffect(() => {
        if (props.config?.bounds)
            grapherState.current.externalBounds = props.config.bounds
    }, [props.config?.bounds, grapherState])

    React.useEffect(() => {
        const abortController = new AbortController()

        async function fetchConfigAndLoadData(): Promise<void> {
            if (props.configUrl) {
                try {
                    const fetchedConfig = await fetch(props.configUrl, {
                        signal: abortController.signal,
                    }).then((res) => res.json())

                    if (abortController.signal.aborted) return

                    const migratedConfig =
                        migrateGrapherConfigToLatestVersion(fetchedConfig)

                    const mergedConfig = {
                        ...migratedConfig,
                        ...props.config,
                    }
                    setDownloadedConfig(mergedConfig)
                    // Batch the grapher updates to avoid getting intermediate
                    // grapherChangedParams values, which make the URL update
                    // multiple times while flashing.
                    // https://stackoverflow.com/a/48610973/9846837

                    // TODO we may not need to this anymore in React 18.
                    unstable_batchedUpdates(() => {
                        grapherState.current.reset()
                        grapherState.current.updateFromObject(mergedConfig)
                        grapherState.current.legacyConfigAsAuthored =
                            mergedConfig
                        grapherState.current.isConfigReady = true

                        // We now need to make sure that the query params are re-applied again
                        grapherState.current.populateFromQueryParams(
                            legacyToCurrentGrapherQueryParams(
                                grapherState.current.initialOptions.queryStr ??
                                    ""
                            )
                        )
                    })
                } catch (error) {
                    if (error instanceof Error && error.name !== "AbortError") {
                        console.error("Failed to fetch config:", error)
                    }
                }
            }
        }
        void fetchConfigAndLoadData()

        return (): void => {
            abortController.abort()
        }
    }, [props.config, props.configUrl, grapherState])

    React.useEffect(() => {
        let isCancelled = false

        async function fetchData(): Promise<void> {
            const inputTable = await fetchInputTableForConfig({
                dimensions:
                    downloadedConfig?.dimensions ?? props.config?.dimensions,
                selectedEntityColors:
                    downloadedConfig?.selectedEntityColors ??
                    props.config?.selectedEntityColors,
                dataApiUrl: props.dataApiUrl,
                archiveContext: props.archiveContext,
                noCache: props.noCache,
            })

            if (isCancelled) return

            if (inputTable) grapherState.current.inputTable = inputTable
        }
        void fetchData()

        return (): void => {
            isCancelled = true
        }
    }, [
        props.config?.dimensions,
        props.dataApiUrl,
        downloadedConfig?.dimensions,
        downloadedConfig?.selectedEntityColors,
        props.config?.selectedEntityColors,
        props.archiveContext,
        props.noCache,
        grapherState,
    ])

    return <Grapher grapherState={grapherState.current} />
}
