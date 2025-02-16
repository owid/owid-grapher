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
import { legacyToCurrentGrapherQueryParams } from "./GrapherUrlMigrations.js"
import { fetchInputTableForConfig } from "./loadGrapherTableHelpers.js"

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

    // update grapherState when the config from props changes
    React.useEffect(() => {
        if (props.config?.bounds)
            grapherState.current.externalBounds = props.config.bounds
    }, [props.config?.bounds])

    React.useEffect(() => {
        async function fetchConfigAndLoadData(): Promise<void> {
            if (props.configUrl) {
                const fetchedConfig = await fetch(props.configUrl).then((res) =>
                    res.json()
                )
                const mergedConfig = {
                    ...fetchedConfig,
                    ...props.config,
                }
                setDownloadedConfig(mergedConfig)
                grapherState.current.updateFromObject(mergedConfig)
                // We now need to make sure that the query params are re-applied again
                grapherState.current.populateFromQueryParams(
                    legacyToCurrentGrapherQueryParams(
                        grapherState.current.initialOptions.queryStr ?? ""
                    )
                )
            }
        }
        void fetchConfigAndLoadData()
    }, [props.config, props.configUrl])

    React.useEffect(() => {
        async function fetchData(): Promise<void> {
            const inputTable = await fetchInputTableForConfig(
                downloadedConfig?.dimensions ?? props.config?.dimensions ?? [],
                downloadedConfig?.selectedEntityColors ??
                    props.config?.selectedEntityColors,
                props.dataApiUrl,
                props.archivedChartInfo
            )
            if (inputTable) grapherState.current.inputTable = inputTable
        }
        void fetchData()
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
