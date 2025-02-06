import {
    GrapherInterface,
    MultipleOwidVariableDataDimensionsMap,
    OwidChartDimensionInterface,
    OwidChartDimensionInterfaceWithMandatorySlug,
    OwidVariableDataMetadataDimensions,
} from "@ourworldindata/types"
import React from "react"
import {
    Grapher,
    GrapherProgrammaticInterface,
    GrapherState,
} from "./Grapher.js"
import { loadVariableDataAndMetadata } from "./loadVariable.js"
import { legacyToOwidTableAndDimensionsWithMandatorySlug } from "./LegacyToOwidTable.js"
import { OwidTable } from "@ourworldindata/core-table"
import { isEqual } from "@ourworldindata/utils"

export interface FetchingGrapherProps {
    config?: GrapherProgrammaticInterface
    configUrl?: string
    dataApiUrl: string
}
export function FetchingGrapher(
    props: FetchingGrapherProps
): JSX.Element | null {
    // if config is not provided, fetch it from configUrl

    const [downloadedConfig, setdownloadedConfig] = React.useState<
        GrapherInterface | undefined
    >(undefined)

    const grapherState = React.useRef<GrapherState>(
        new GrapherState({
            ...props.config,
            dataApiUrl: props.dataApiUrl,
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
                setdownloadedConfig(fetchedConfig)
                grapherState.current.updateFromObject(fetchedConfig)
            }
        }
        void fetchConfigAndLoadData()
    }, [props.configUrl])

    React.useEffect(() => {
        async function fetchData(): Promise<void> {
            const inputTable = await fetchInputTableForConfig(
                downloadedConfig?.dimensions ?? props.config?.dimensions ?? [],
                downloadedConfig?.selectedEntityColors ??
                    props.config?.selectedEntityColors,
                props.dataApiUrl
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
    ])

    return <Grapher grapherState={grapherState.current} />
}

export async function fetchInputTableForConfig(
    dimensions: OwidChartDimensionInterface[],
    selectedEntityColors:
        | { [entityName: string]: string | undefined }
        | undefined,
    dataApiUrl: string
): Promise<OwidTable | undefined> {
    if (dimensions.length === 0) return undefined
    const variables = dimensions.map((d) => d.variableId)
    const variablesDataMap = await loadVariablesDataSite(variables, dataApiUrl)
    const inputTable = legacyToOwidTableAndDimensionsWithMandatorySlug(
        variablesDataMap,
        dimensions,
        selectedEntityColors
    )

    return inputTable
}

export function getCachingInputTableFetcher(
    dataApiUrl: string
): (
    dimensions: OwidChartDimensionInterfaceWithMandatorySlug[],
    selectedEntityColors:
        | { [entityName: string]: string | undefined }
        | undefined
) => Promise<OwidTable | undefined> {
    const cache: Map<number, OwidVariableDataMetadataDimensions> = new Map()
    let previousDimensions: OwidChartDimensionInterface[] = []

    return async (
        dimensions: OwidChartDimensionInterfaceWithMandatorySlug[],
        selectedEntityColors:
            | { [entityName: string]: string | undefined }
            | undefined
    ) => {
        // Check if dimensions have changed

        if (isEqual(previousDimensions, dimensions)) {
            return undefined // No changes in dimensions
        }
        previousDimensions = dimensions

        if (dimensions.length === 0) return undefined

        const variables = dimensions.map((d) => d.variableId)
        const variablesToFetch = variables.filter((v) => !cache.has(v))

        if (variablesToFetch.length > 0) {
            const fetchedData = await Promise.all(
                variablesToFetch.map((variableId) =>
                    loadVariableDataAndMetadata(variableId, dataApiUrl)
                )
            )
            fetchedData.forEach((data) => cache.set(data.metadata.id, data))
        }

        const variablesDataMap = new Map(
            variables.map((v) => [v, cache.get(v)!])
        )

        const inputTable = legacyToOwidTableAndDimensionsWithMandatorySlug(
            variablesDataMap,
            dimensions,
            selectedEntityColors
        )

        return inputTable
    }
}

async function loadVariablesDataSite(
    variableIds: number[],
    dataApiUrl: string
): Promise<MultipleOwidVariableDataDimensionsMap> {
    const loadVariableDataPromises = variableIds.map((variableId) =>
        loadVariableDataAndMetadata(variableId, dataApiUrl)
    )
    const variablesData: OwidVariableDataMetadataDimensions[] =
        await Promise.all(loadVariableDataPromises)
    const variablesDataMap = new Map(
        variablesData.map((data) => [data.metadata.id, data])
    )
    return variablesDataMap
}
