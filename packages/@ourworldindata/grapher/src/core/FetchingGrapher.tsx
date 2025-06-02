import {
    GrapherInterface,
    OwidVariableDataMetadataDimensions,
    ArchivedChartOrArchivePageMeta,
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
import { action } from "mobx"
import { legacyToCurrentGrapherQueryParams } from "./GrapherUrlMigrations.js"

export interface FetchingGrapherProps {
    config?: GrapherProgrammaticInterface
    configUrl?: string
    dataApiUrl: string
    archivedChartInfo: ArchivedChartOrArchivePageMeta | undefined
    queryStr?: string
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
                loadVariableDataAndMetadata(varId, props.dataApiUrl),
            queryStr: props.queryStr,
        })
    )

    // TODO Daniel: remove this
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

                    const mergedConfig = {
                        ...fetchedConfig,
                        ...props.config,
                    }
                    setDownloadedConfig(mergedConfig)
                    action(() => {
                        grapherState.current.updateFromObject(mergedConfig)
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
                props.archivedChartInfo
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
    ])

    return <Grapher grapherState={grapherState.current} />
}
