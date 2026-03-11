import { createRoot, Root } from "react-dom/client"
import { debounce } from "lodash-es"
import { GrapherInterface } from "@ourworldindata/types"
import { Bounds } from "@ourworldindata/utils"
import { OwidTable } from "@ourworldindata/core-table"
import { Grapher } from "./core/Grapher.js"
import { GrapherState } from "./core/GrapherState.js"
import { FetchingGrapher } from "./core/FetchingGrapher.js"
import { fetchInputTableForConfig } from "./core/loadGrapherTableHelpers.js"

const DEFAULT_DATA_API_URL = "https://api.ourworldindata.org/v1/indicators/"
const DEFAULT_CATALOG_URL = "https://catalog.ourworldindata.org"

interface GrapherApiOptions {
    /** Grapher configuration object (chart type, dimensions, display, etc.) */
    config: GrapherInterface
    /**
     * Data to display. Can be:
     * - a URL string to fetch data from (e.g. a data API endpoint)
     * - an OwidTable instance with pre-loaded data
     */
    data?: string | OwidTable
    /**
     * Base URL for the OWID data API.
     * Defaults to "https://api.ourworldindata.org/v1/indicators/"
     */
    dataApiUrl?: string
    /**
     * Base URL for the OWID catalog API.
     * Defaults to "https://owid.cloud/admin/api/charts"
     */
    catalogUrl?: string
}

interface GrapherHandle {
    /** The underlying GrapherState — use this to read or modify chart state programmatically */
    grapherState: GrapherState
    /** Unmount the grapher and disconnect all observers */
    dispose: () => void
}

export function renderGrapherIntoContainer(
    container: Element,
    options: GrapherApiOptions
): GrapherHandle {
    const {
        config,
        data,
        dataApiUrl = DEFAULT_DATA_API_URL,
        catalogUrl = DEFAULT_CATALOG_URL,
    } = options

    let reactRoot: Root
    let grapherState: GrapherState

    if (data instanceof OwidTable) {
        // Data provided directly — render Grapher with the table
        grapherState = new GrapherState({
            ...config,
            table: data,
            isConfigReady: true,
            isDataReady: true,
        })

        reactRoot = createRoot(container)
        const renderWithBounds = (bounds: Bounds): void => {
            grapherState.externalBounds = bounds
            reactRoot.render(<Grapher grapherState={grapherState} />)
        }

        observeContainerSize(container, renderWithBounds)
    } else if (typeof data === "string") {
        // Data is a URL — fetch config, then load data from the URL
        grapherState = new GrapherState({
            ...config,
            isConfigReady: true,
            isDataReady: false,
        })

        reactRoot = createRoot(container)
        const renderWithBounds = (bounds: Bounds): void => {
            grapherState.externalBounds = bounds
            reactRoot.render(<Grapher grapherState={grapherState} />)
        }

        observeContainerSize(container, renderWithBounds)

        // Fetch data from the provided URL
        void fetchInputTableForConfig({
            dimensions: config.dimensions,
            selectedEntityColors: config.selectedEntityColors,
            dataApiUrl: data,
        }).then((table) => {
            if (table) grapherState.inputTable = table
            grapherState.isDataReady = true
        })
    } else {
        // No data provided — use FetchingGrapher which handles
        // fetching data from the OWID data API based on config.dimensions
        grapherState = new GrapherState({
            ...config,
            isConfigReady: false,
        })

        reactRoot = createRoot(container)
        const renderWithBounds = (bounds: Bounds): void => {
            reactRoot.render(
                <FetchingGrapher
                    config={config}
                    dataApiUrl={dataApiUrl}
                    catalogUrl={catalogUrl}
                    archiveContext={undefined}
                    externalBounds={bounds}
                />
            )
        }

        observeContainerSize(container, renderWithBounds)
    }

    return {
        grapherState,
        dispose: () => {
            reactRoot.unmount()
        },
    }
}

function observeContainerSize(
    container: Element,
    onResize: (bounds: Bounds) => void
): void {
    const resizeObserver = new ResizeObserver(
        debounce(
            (entries: ResizeObserverEntry[]) => {
                const entry = entries[0]
                if (!entry) return
                if ((entry.target as HTMLElement).offsetParent === null) return
                onResize(Bounds.fromRect(entry.contentRect))
            },
            400,
            { leading: true }
        )
    )
    resizeObserver.observe(container)
}
