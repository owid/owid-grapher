import { createRoot } from "react-dom/client"
import { useEffect, useRef } from "react"
import { GrapherInterface, OwidColumnDef } from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { Grapher } from "./core/Grapher.js"
import { GrapherState } from "./core/GrapherState.js"
import { fetchInputTableForConfig } from "./core/loadGrapherTableHelpers.js"
import { useElementBounds } from "./hooks.js"

const DEFAULT_DATA_API_URL = "https://api.ourworldindata.org/v1/indicators/"

interface GrapherApiOptionsBase {
    /** Grapher configuration object (chart type, dimensions, display, etc.) */
    config: GrapherInterface
}

/** Provide a pre-built OwidTable directly as the chart's data source. */
interface GrapherApiOptionsWithTable extends GrapherApiOptionsBase {
    data: OwidTable
}

/** Fetch a CSV file from a URL and use it as the chart's data source. */
interface GrapherApiOptionsWithCsv extends GrapherApiOptionsBase {
    /** URL of a CSV file to fetch. Must have entityName, entityCode, entityId,
     *  and year (or day) columns, plus one or more value columns. */
    csvUrl: string
    /** Column definitions to apply — use these to specify types and display
     *  names for your value columns. */
    columnDefs?: OwidColumnDef[]
}

/** Load data from the OWID data API (default behaviour). */
interface GrapherApiOptionsWithApi extends GrapherApiOptionsBase {
    /** Base URL for the OWID data API.
     *  Defaults to "https://api.ourworldindata.org/v1/indicators/" */
    dataApiUrl?: string
}

type GrapherApiOptions =
    | GrapherApiOptionsWithTable
    | GrapherApiOptionsWithCsv
    | GrapherApiOptionsWithApi

interface GrapherHandle {
    /** The underlying GrapherState — use this to read or modify chart state programmatically */
    grapherState: GrapherState
    /** Unmount the grapher and disconnect all observers */
    dispose: () => void
}

/** Thin wrapper that observes the container's size via useElementBounds
 *  and syncs it to grapherState.externalBounds (MobX observable).
 *  Grapher is rendered once; subsequent size changes flow through MobX
 *  without triggering a React re-render of this component's parent. */
function BoundsObservingGrapher({
    grapherState,
    container,
}: {
    grapherState: GrapherState
    container: HTMLElement
}): React.ReactElement {
    const containerRef = useRef<HTMLElement>(container)
    const bounds = useElementBounds(containerRef)

    useEffect(() => {
        grapherState.externalBounds = bounds
    }, [grapherState, bounds])

    return <Grapher grapherState={grapherState} />
}

export function renderGrapherIntoContainer(
    container: HTMLElement,
    options: GrapherApiOptions
): GrapherHandle {
    const { config } = options

    let grapherState: GrapherState

    if ("data" in options) {
        // Pre-loaded table provided directly
        grapherState = new GrapherState({
            ...config,
            table: options.data,
            isConfigReady: true,
            isDataReady: true,
        })
    } else if ("csvUrl" in options) {
        // Fetch and parse a CSV file from the given URL
        grapherState = new GrapherState({
            ...config,
            isConfigReady: true,
            isDataReady: false,
        })

        void OwidTable.fromUrl(options.csvUrl, options.columnDefs).then(
            (table) => {
                grapherState.inputTable = table
                grapherState.isDataReady = true
            }
        )
    } else {
        // Fetch data from the OWID data API
        const dataApiUrl = options.dataApiUrl ?? DEFAULT_DATA_API_URL
        grapherState = new GrapherState({
            ...config,
            isConfigReady: true,
            isDataReady: false,
        })

        void fetchInputTableForConfig({
            dimensions: config.dimensions,
            selectedEntityColors: config.selectedEntityColors,
            dataApiUrl,
        }).then((table) => {
            if (table) grapherState.inputTable = table
            grapherState.isDataReady = true
        })
    }

    // Render once — bounds updates flow through MobX, not re-renders
    const reactRoot = createRoot(container)
    reactRoot.render(
        <BoundsObservingGrapher
            grapherState={grapherState}
            container={container}
        />
    )

    return {
        grapherState,
        dispose: () => reactRoot.unmount(),
    }
}
