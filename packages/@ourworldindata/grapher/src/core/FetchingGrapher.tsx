import {
    GrapherInterface,
    MultipleOwidVariableDataDimensionsMap,
    OwidChartDimensionInterface,
    OwidVariableDataMetadataDimensions,
} from "@ourworldindata/types"
import React from "react"
import { Grapher, GrapherState } from "./Grapher.js"
import { loadVariableDataAndMetadata } from "./loadVariable.js"
import {
    legacyToOwidTableAndDimensions,
    legacyToOwidTableAndDimensionsWithMandatorySlug,
} from "./LegacyToOwidTable.js"
import { OwidTable } from "@ourworldindata/core-table"
import { isEqual } from "@ourworldindata/utils"

export interface FetchingGrapherProps {
    config?: GrapherInterface
    configUrl?: string
    queryString?: string
    dataApiUrl: string
    adminBaseUrl: string
    bakedGrapherURL: string
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
            queryStr: props.queryString,
            dataApiUrl: props.dataApiUrl,
            adminBaseUrl: props.adminBaseUrl,
            bakedGrapherURL: props.bakedGrapherURL,
        })
    )

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
    }, [
        props.configUrl,
        props.dataApiUrl,
        props.queryString,
        props.adminBaseUrl,
        props.bakedGrapherURL,
    ])

    React.useEffect(() => {
        async function fetchData(): Promise<void> {
            const inputTable = await fetchInputTableForConfig(
                { ...props.config, ...downloadedConfig },
                props.dataApiUrl
            )
            if (inputTable) grapherState.current.inputTable = inputTable
        }
        void fetchData()
    }, [props.config, props.dataApiUrl, downloadedConfig])

    return <Grapher grapherState={grapherState.current} />
}

export async function fetchInputTableForConfig(
    config: GrapherInterface,
    dataApiUrl: string
): Promise<OwidTable | undefined> {
    const dimensions = config.dimensions || []
    if (dimensions.length === 0) return undefined
    const variables = dimensions.map((d) => d.variableId)
    const variablesDataMap = await loadVariablesDataSite(variables, dataApiUrl)
    const inputTable = legacyToOwidTableAndDimensionsWithMandatorySlug(
        variablesDataMap,
        dimensions,
        config.selectedEntityColors
    )

    return inputTable
}

export function getCachingInputTableFetcher(dataApiUrl: string): (
    dimensions: OwidChartDimensionInterface[],

    selectedEntityColors:
        | { [entityName: string]: string | undefined }
        | undefined
) => Promise<OwidTable | undefined> {
    const cache: Map<number, OwidVariableDataMetadataDimensions> = new Map()
    let previousDimensions: OwidChartDimensionInterface[] = []

    return async (
        dimensions: OwidChartDimensionInterface[],
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
