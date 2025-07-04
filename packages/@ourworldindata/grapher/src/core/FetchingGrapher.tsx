import {
    GrapherInterface,
    OwidVariableDataMetadataDimensions,
    ArchiveContext,
    OwidVariableId,
} from "@ourworldindata/types"
import React from "react"
import {
    Grapher,
    GrapherProgrammaticInterface,
    GrapherState,
} from "./Grapher.js"
import { loadVariableDataAndMetadata } from "./loadVariable.js"
import { fetchInputTableForConfig } from "./loadGrapherTableHelpers.js"
import { legacyToCurrentGrapherQueryParams } from "./GrapherUrlMigrations.js"
import { unstable_batchedUpdates } from "react-dom"
import { Bounds } from "@ourworldindata/utils"
import { migrateGrapherConfigToLatestVersion } from "../schema/migrations/migrate.js"
import { match } from "ts-pattern"
import { mapTabOptionToChartTypeName } from "../chart/ChartUtils.js"
import { defaultGrapherConfig } from "../schema/defaultGrapherConfig.js"

export interface FetchingGrapherProps {
    config?: GrapherProgrammaticInterface
    configUrl?: string
    dataApiUrl: string
    archivedChartInfo: ArchiveContext | undefined
    queryStr?: string
    externalBounds?: Bounds
    noCache?: boolean
}

export function FetchingGrapher(
    props: FetchingGrapherProps
): JSX.Element | null {
    // if config is not provided, fetch it from configUrl

    const [downloadedConfig, setDownloadedConfig] = React.useState<
        GrapherInterface | undefined
    >(undefined)

    const grapherState = React.useRef<GrapherState>(
        new GrapherState({
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
    )

    React.useEffect(() => {
        if (props.externalBounds) {
            grapherState.current.externalBounds = props.externalBounds
        }
    }, [props.externalBounds])

    // update grapherState when the config from props changes
    React.useEffect(() => {
        if (props.config?.bounds)
            grapherState.current.externalBounds = props.config.bounds
    }, [props.config?.bounds])

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
                        ...defaultGrapherConfig,
                        ...migratedConfig,
                        ...props.config,
                    }
                    setDownloadedConfig(mergedConfig)
                    // Batch the grapher updates to avoid getting intermediate
                    // grapherChangedParams values, which make the URL update
                    // multiple times while flashing.
                    // https://stackoverflow.com/a/48610973/9846837
                    unstable_batchedUpdates(() => {
                        grapherState.current.reset()
                        grapherState.current.updateFromObject(mergedConfig)
                        grapherState.current.legacyConfigAsAuthored =
                            mergedConfig
                        grapherState.current.isConfigReady = true
                        // Special logic to handle the tab option
                        if (mergedConfig.tab) {
                            match(mergedConfig.tab)
                                .with("table", () => {
                                    grapherState.current.tab = "table"
                                })
                                .with("map", () => {
                                    grapherState.current.tab = "map"
                                })
                                .with("chart", () => {
                                    grapherState.current.tab = "chart"
                                })
                                .with("line", () => {
                                    grapherState.current.tab = "chart"
                                    const chartTab =
                                        mapTabOptionToChartTypeName(
                                            mergedConfig.tab!
                                        )
                                    grapherState.current.chartTab = chartTab
                                })
                                .with("slope", () => {
                                    grapherState.current.tab = "chart"
                                    const chartTab =
                                        mapTabOptionToChartTypeName(
                                            mergedConfig.tab!
                                        )
                                    grapherState.current.chartTab = chartTab
                                })
                                .exhaustive()
                        }
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
    }, [props.config, props.configUrl])

    React.useEffect(() => {
        let isCancelled = false

        async function fetchData(): Promise<void> {
            const inputTable = await fetchInputTableForConfig(
                downloadedConfig?.dimensions ?? props.config?.dimensions ?? [],
                downloadedConfig?.selectedEntityColors ??
                    props.config?.selectedEntityColors,
                props.dataApiUrl,
                props.archivedChartInfo,
                props.noCache
            )

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
        props.archivedChartInfo,
        props.noCache,
    ])

    return <Grapher grapherState={grapherState.current} />
}
