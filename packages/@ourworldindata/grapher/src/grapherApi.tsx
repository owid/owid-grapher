import { createRoot } from "react-dom/client"
import { useEffect, useRef } from "react"
import { GrapherInterface } from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { Grapher } from "./core/Grapher.js"
import { GrapherState } from "./core/GrapherState.js"
import { fetchInputTableForConfig } from "./core/loadGrapherTableHelpers.js"
import { useElementBounds } from "./hooks.js"

const DEFAULT_DATA_API_URL = "https://api.ourworldindata.org/v1/indicators/"

interface GrapherApiOptions {
    /** Grapher configuration object (chart type, dimensions, display, etc.) */
    config: GrapherInterface
    /**
     * Data to display. Can be:
     * - a URL to fetch data from (e.g. a data API endpoint)
     * - a string of CSV data
     * - an OwidTable instance with pre-loaded data
     */
    data?: URL | string | OwidTable
    /**
     * Base URL for the OWID data API.
     * Defaults to "https://api.ourworldindata.org/v1/indicators/"
     */
    dataApiUrl?: string
}

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
    const { config, data, dataApiUrl = DEFAULT_DATA_API_URL } = options

    let grapherState: GrapherState

    if (data instanceof OwidTable) {
        // Data provided directly
        grapherState = new GrapherState({
            ...config,
            table: data,
            isConfigReady: true,
            isDataReady: true,
        })
    } else {
        // Fetch data — from the given URL/string, or from the OWID data API
        grapherState = new GrapherState({
            ...config,
            isConfigReady: true,
            isDataReady: false,
        })

        void fetchInputTableForConfig({
            dimensions: config.dimensions,
            selectedEntityColors: config.selectedEntityColors,
            dataApiUrl: typeof data === "string" ? data : dataApiUrl,
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
