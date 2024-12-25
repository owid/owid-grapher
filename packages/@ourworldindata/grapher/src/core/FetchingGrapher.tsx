import {
    GrapherInterface,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableDataMetadataDimensions,
} from "@ourworldindata/types"
import React from "react"
import { Grapher } from "./Grapher.js"
import { loadVariableDataAndMetadata } from "./loadVariable.js"
import { legacyToOwidTableAndDimensions } from "./LegacyToOwidTable.js"
import { OwidTable } from "@ourworldindata/core-table"

export interface FetchingGrapherProps {
    config?: GrapherInterface
    configUrl?: string
    queryString?: string
    dataApiUrl: string
}
export async function FetchingGrapher(
    props: FetchingGrapherProps
): Promise<React.JSX.Element | null> {
    // if config is not provided, fetch it from configUrl

    const [config, setConfig] = React.useState<GrapherInterface | undefined>(
        undefined
    )

    const [inputTable, setInputTable] = React.useState<OwidTable | undefined>(
        undefined
    )

    React.useEffect(() => {
        async function fetchConfigAndLoadData(): Promise<void> {
            if (!config && props.configUrl) {
                const fetchedConfig = await fetch(props.configUrl).then((res) =>
                    res.json()
                )
                setConfig(fetchedConfig)
            }
            if (!config) return
            const dimensions = config.dimensions || []
            if (dimensions.length === 0) return
            const variables = dimensions.map((d) => d.variableId)
            const variablesDataMap = await loadVariablesDataSite(
                variables,
                props.dataApiUrl
            )
            const inputTable = legacyToOwidTableAndDimensions(
                variablesDataMap,
                dimensions
            )
            setInputTable(inputTable)
        }
        void fetchConfigAndLoadData()
    }, [props.configUrl, config, props.dataApiUrl])

    if (!config) return null
    if (!inputTable) return null
    return <Grapher table={inputTable} queryStr={props.queryString} />
}

// async function loadVariablesDataAdmin(
//     variableFetchBaseUrl: string | undefined,
//     variableIds: number[]
// ): Promise<MultipleOwidVariableDataDimensionsMap> {
//     const dataFetchPath = (variableId: number): string =>
//         variableFetchBaseUrl
//             ? `${variableFetchBaseUrl}/v1/variableById/data/${variableId}`
//             : `/api/data/variables/data/${variableId}.json`
//     const metadataFetchPath = (variableId: number): string =>
//         variableFetchBaseUrl
//             ? `${variableFetchBaseUrl}/v1/variableById/metadata/${variableId}`
//             : `/api/data/variables/metadata/${variableId}.json`

//     const loadVariableDataPromises = variableIds.map(async (variableId) => {
//         const dataPromise = window.admin.getJSON(
//             dataFetchPath(variableId)
//         ) as Promise<OwidVariableMixedData>
//         const metadataPromise = window.admin.getJSON(
//             metadataFetchPath(variableId)
//         ) as Promise<OwidVariableWithSourceAndDimension>
//         const [data, metadata] = await Promise.all([
//             dataPromise,
//             metadataPromise,
//         ])
//         return { data, metadata: { ...metadata, id: variableId } }
//     })
//     const variablesData: OwidVariableDataMetadataDimensions[] =
//         await Promise.all(loadVariableDataPromises)
//     const variablesDataMap = new Map(
//         variablesData.map((data) => [data.metadata.id, data])
//     )
//     return variablesDataMap
// }

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

// function downloadData(): void {
//     if (this.manuallyProvideData) {
//     } else if (this.owidDataset) {
//         this._receiveOwidDataAndApplySelection(this.owidDataset)
//     } else void this.downloadLegacyDataFromOwidVariableIds()
// }

// async function downloadLegacyDataFromOwidVariableIds(
//     inputTableTransformer?: ChartTableTransformer
// ): Promise<void> {
//     if (this.variableIds.length === 0)
//         // No data to download
//         return

//     try {
//         let variablesDataMap: MultipleOwidVariableDataDimensionsMap

//         const startMark = performance.now()
//         if (this.useAdminAPI) {
//             // TODO grapher model: switch this to downloading multiple data and metadata files
//             variablesDataMap = await loadVariablesDataAdmin(
//                 this.dataApiUrlForAdmin,
//                 this.variableIds
//             )
//         } else {
//             variablesDataMap = await loadVariablesDataSite(
//                 this.variableIds,
//                 this.dataApiUrl
//             )
//         }
//         this.createPerformanceMeasurement("downloadVariablesData", startMark)

//         this._receiveOwidDataAndApplySelection(
//             variablesDataMap,
//             inputTableTransformer
//         )
//     } catch (err) {
//         // eslint-disable-next-line no-console
//         console.log(`Error fetching '${err}'`)
//         console.error(err)
//         Bugsnag?.notify(`Error fetching variables: ${err}`, (event) => {
//             event.addMetadata("context", {
//                 variableIds: this.variableIds,
//             })
//         })
//     }
// }
