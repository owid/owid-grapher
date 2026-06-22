import { createRoot, Root } from "react-dom/client"
import { useEffect, useRef } from "react"
import { GrapherInterface, OwidColumnDef } from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { Grapher, GrapherProgrammaticInterface } from "./core/Grapher.js"
import { GrapherState } from "./core/GrapherState.js"
import { fetchInputTableForConfig } from "./core/loadGrapherTableHelpers.js"
import { useElementBounds } from "./hooks.js"

const DEFAULT_DATA_API_URL = "https://api.ourworldindata.org/v1/indicators/"

// --- Options types -----------------------------------------------------------

interface GrapherApiOptionsBase {
    config: GrapherInterface
}

/** Options for {@link GrapherLoader.fromTable}. */
export interface FromTableOptions extends GrapherApiOptionsBase {
    data: OwidTable
}

/** Options for {@link GrapherLoader.fromCsv}. */
export interface FromCsvOptions extends GrapherApiOptionsBase {
    /** URL of a CSV file to fetch. Must have entityName, entityCode, entityId,
     *  and year (or day) columns, plus one or more value columns. */
    csvUrl: string
    /** Column definitions — use these to specify types and display names for
     *  your value columns. */
    columnDefs?: OwidColumnDef[]
}

/** Options for {@link GrapherLoader.fromApi}. */
export interface FromApiOptions extends GrapherApiOptionsBase {
    /** Base URL for the OWID data API.
     *  Defaults to "https://api.ourworldindata.org/v1/indicators/" */
    dataApiUrl?: string
}

const DEFAULT_GRAPHER_CONFIG_OVERRIDES: Partial<GrapherProgrammaticInterface> =
    {
        manager: {}, // explicitly set this, so that `useIdealBounds` is false and we can specify custom bounds
    }

// --- Internal React component ------------------------------------------------

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

// --- Public API --------------------------------------------------------------

/**
 * Builder for rendering a Grapher chart into a DOM container.
 *
 * Call one of the static factory methods to configure the data source, then
 * call {@link mount} to render the chart. The instance acts as the handle for
 * the mounted chart.
 *
 * @example
 * // From a pre-built OwidTable
 * GrapherLoader.fromTable({ data: table, title: "My chart" }).mount(container)
 *
 * // From a CSV URL
 * GrapherLoader
 *     .fromCsv({ csvUrl: "./data.csv", columnDefs: [{ slug: "gdp", type: "Numeric", name: "GDP" }], title: "My chart" })
 *     .mount(container)
 *
 * // From the OWID data API
 * GrapherLoader.fromApi({ title: "My chart" }).mount(container)
 *
 * // Unmount later
 * const loader = GrapherLoader.fromApi({ title: "My chart" }).mount(container)
 * loader.dispose()
 */
export class GrapherLoader {
    /** The underlying GrapherState — use this to read or modify chart state programmatically. */
    readonly grapherState: GrapherState
    private _reactRoot: Root | null = null

    private constructor(grapherState: GrapherState) {
        this.grapherState = grapherState
    }

    /**
     * Render the chart into the given container.
     * Data fetching (if any) starts at construction time, so the chart will
     * show a loading state until the data arrives.
     * Returns `this` for optional chaining.
     */
    mount(container: HTMLElement): this {
        this._reactRoot = createRoot(container)
        this._reactRoot.render(
            <BoundsObservingGrapher
                grapherState={this.grapherState}
                container={container}
            />
        )
        return this
    }

    /** Unmount the chart and disconnect all observers. */
    dispose(): void {
        this._reactRoot?.unmount()
        this._reactRoot = null
    }

    /** Prepare a chart whose data comes from a pre-built OwidTable. */
    static fromTable({ config, data }: FromTableOptions): GrapherLoader {
        const grapherState = new GrapherState({
            ...DEFAULT_GRAPHER_CONFIG_OVERRIDES,
            ...config,
            table: data,
            isConfigReady: true,
            isDataReady: true,
        })
        return new GrapherLoader(grapherState)
    }

    /** Prepare a chart whose data will be fetched from a CSV file at the given URL. */
    static fromCsv({
        config,
        csvUrl,
        columnDefs,
    }: FromCsvOptions): GrapherLoader {
        const grapherState = new GrapherState({
            ...DEFAULT_GRAPHER_CONFIG_OVERRIDES,
            ...config,
            isConfigReady: true,
            isDataReady: false,
        })
        void OwidTable.fromUrl(csvUrl, columnDefs).then((table) => {
            grapherState.inputTable = table
            grapherState.isDataReady = true
        })
        return new GrapherLoader(grapherState)
    }

    /** Prepare a chart whose data will be fetched from the OWID data API. */
    static fromApi({
        config,
        dataApiUrl = DEFAULT_DATA_API_URL,
    }: FromApiOptions): GrapherLoader {
        const grapherState = new GrapherState({
            ...DEFAULT_GRAPHER_CONFIG_OVERRIDES,
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
        return new GrapherLoader(grapherState)
    }
}
