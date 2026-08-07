import { createRoot, Root } from "react-dom/client"
import { useRef } from "react"
import { useIsomorphicLayoutEffect } from "usehooks-ts"
import {
    GrapherInterface,
    OwidChartDimensionInterface,
    OwidColumnDef,
} from "@ourworldindata/types"
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

/** Options for {@link GrapherLoader.fromCsv}. Provide the CSV either inline
 *  (`csv`) or as a URL to fetch (`csvUrl`). It must have entityName,
 *  entityCode, entityId, and year (or day) columns, plus one or more value
 *  columns. */
export type FromCsvOptions = GrapherApiOptionsBase & {
    /** Column definitions — use these to specify types and display names for
     *  your value columns. */
    columnDefs?: OwidColumnDef[]
} & (
        | {
              /** URL of a CSV file to fetch. */
              csvUrl: string
              csv?: never
          }
        | {
              /** CSV content as an inline string. */
              csv: string
              csvUrl?: never
          }
    )

/** Options for {@link GrapherLoader.fromApi}. */
export interface FromApiOptions extends GrapherApiOptionsBase {
    /** The config must say which indicators to fetch: a `dimensions` array
     *  with at least a `y` entry (e.g. `{ property: "y", variableId: 1118466 }`). */
    config: GrapherInterface & { dimensions: OwidChartDimensionInterface[] }
    /** Base URL for the OWID data API.
     *  Defaults to "https://api.ourworldindata.org/v1/indicators/" */
    dataApiUrl?: string
}

// A function rather than a shared constant: the returned object is spread
// into a mutable GrapherState, so each chart must get its own copy.
function defaultGrapherConfigOverrides(): Partial<GrapherProgrammaticInterface> {
    return {
        manager: {}, // explicitly set this, so that `useIdealBounds` is false and we can specify custom bounds
    }
}

// --- Internal React component ------------------------------------------------

/** Renders Grapher into the caller's container, keeping
 *  `grapherState.externalBounds` in sync with that container's size so the
 *  chart fills it — GrapherLoader turns off Grapher's own ideal-bounds sizing
 *  (see `defaultGrapherConfigOverrides`), which makes externalBounds the single
 *  source of truth for how big the chart is.
 *
 *  Nothing renders until the container has been measured: starting from the
 *  default bounds instead makes the chart visibly render 850px wide for a frame
 *  before its real size arrives. Bounds are written in a layout effect so the
 *  value is in place before the browser paints.
 *
 *  Size changes reach Grapher through the MobX observable rather than through
 *  props, so `Grapher` is never re-rendered by a prop change. */
function BoundsObservingGrapher({
    grapherState,
    container,
}: {
    grapherState: GrapherState
    container: HTMLElement
}): React.ReactElement | null {
    const containerRef = useRef<HTMLElement>(container)
    const bounds = useElementBounds(containerRef, null)

    useIsomorphicLayoutEffect(() => {
        if (bounds) grapherState.externalBounds = bounds
    }, [grapherState, bounds])

    if (!bounds) return null

    // The wrapper styles are load-bearing: the rendered chart must never
    // influence the container's size, or sizing loops ensue. `contain: size`
    // makes the wrapper's size independent of the chart (e.g. a container
    // whose height comes from a CSS aspect-ratio would otherwise be propped
    // open by the previously rendered chart and could grow but never shrink),
    // `overflow: hidden` clips the old render while a resize is throttled,
    // and the flex display keeps the inline-block .GrapherComponent from
    // adding a line box's baseline gap below itself.
    return (
        <div
            style={{
                display: "flex",
                width: "100%",
                height: "100%",
                contain: "size",
                overflow: "hidden",
            }}
        >
            <Grapher grapherState={grapherState} />
        </div>
    )
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
 * GrapherLoader
 *     .fromTable({ config: { title: "My chart" }, data: table })
 *     .mount(container)
 *
 * // From a CSV URL (or pass the content inline via `csv` instead)
 * GrapherLoader
 *     .fromCsv({
 *         config: { title: "My chart" },
 *         csvUrl: "./data.csv",
 *         columnDefs: [{ slug: "gdp", name: "GDP" }],
 *     })
 *     .mount(container)
 *
 * // From the OWID data API (config must include `dimensions`)
 * GrapherLoader
 *     .fromApi({ config: { title: "My chart", dimensions: [...] } })
 *     .mount(container)
 *
 * // Optionally await the data, unmount later
 * const loader = GrapherLoader.fromApi({ config }).mount(container)
 * await loader.ready
 * loader.dispose()
 */
export class GrapherLoader {
    /** The underlying GrapherState — use this to read or modify chart state programmatically. */
    readonly grapherState: GrapherState
    /**
     * Resolves once the chart's data has loaded (immediately for
     * {@link fromTable} and inline-CSV {@link fromCsv}), and rejects if
     * fetching fails — in which case the chart stays in its loading state.
     * Awaiting this is optional; a failure is also logged to the console.
     */
    readonly ready: Promise<void>
    private _reactRoot: Root | null = null

    private constructor(
        grapherState: GrapherState,
        ready: Promise<void> = Promise.resolve()
    ) {
        this.grapherState = grapherState
        this.ready = ready
        // Not every caller awaits `ready`; report failures without producing
        // an unhandled rejection. (This doesn't consume the rejection for
        // callers that do await it.)
        this.ready.catch((error: unknown) => {
            console.error("GrapherLoader failed to load data:", error)
        })
    }

    /**
     * Render the chart into the given container.
     * Data fetching (if any) starts at construction time, so the chart will
     * show a loading state until the data arrives. The chart itself renders
     * lazily once the container is scrolled into view.
     * Returns `this` for optional chaining.
     */
    mount(container: HTMLElement): this {
        if (this._reactRoot)
            throw new Error(
                "This GrapherLoader is already mounted — call dispose() first."
            )
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
            ...defaultGrapherConfigOverrides(),
            ...config,
            table: data,
            isConfigReady: true,
            isDataReady: true,
        })
        return new GrapherLoader(grapherState)
    }

    /** Prepare a chart whose data comes from a CSV, either passed inline as a
     *  string or fetched from a URL. */
    static fromCsv(options: FromCsvOptions): GrapherLoader {
        const { config, columnDefs } = options

        // An inline CSV string can be parsed synchronously, making this
        // equivalent to fromTable.
        if (options.csv !== undefined)
            return GrapherLoader.fromTable({
                config,
                data: new OwidTable(options.csv, columnDefs),
            })

        const grapherState = new GrapherState({
            ...defaultGrapherConfigOverrides(),
            ...config,
            isConfigReady: true,
            isDataReady: false,
        })
        const ready = OwidTable.fromUrl(options.csvUrl, columnDefs).then(
            (table) => {
                grapherState.inputTable = table
                grapherState.isDataReady = true
            }
        )
        return new GrapherLoader(grapherState, ready)
    }

    /** Prepare a chart whose data will be fetched from the OWID data API. */
    static fromApi({
        config,
        dataApiUrl = DEFAULT_DATA_API_URL,
    }: FromApiOptions): GrapherLoader {
        const grapherState = new GrapherState({
            ...defaultGrapherConfigOverrides(),
            ...config,
            isConfigReady: true,
            isDataReady: false,
        })
        const ready = fetchInputTableForConfig({
            dimensions: config.dimensions,
            selectedEntityColors: config.selectedEntityColors,
            dataApiUrl,
        }).then((table) => {
            if (table) grapherState.inputTable = table
            grapherState.isDataReady = true
        })
        return new GrapherLoader(grapherState, ready)
    }
}
