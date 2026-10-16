import * as React from "react"
import { GrapherProgrammaticInterface } from "../core/Grapher.js"
import { GrapherState } from "../core/GrapherState.js"
import { MultiDimDataPageConfig, Url } from "@ourworldindata/utils"
import {
    GrapherQueryParams,
    MultiDimDimensionChoices,
    ChartConfigType,
} from "@ourworldindata/types"

export interface ArchiveGuidedChartRegistration {
    iframeRef: React.RefObject<HTMLIFrameElement | null>
    baseUrl: string
    defaultQueryParams: Record<string, string | undefined>
    chartConfigType: ChartConfigType
}

export interface GuidedChartContextValue {
    /** Called with the chart's GrapherState; returns a function to unregister */
    registerGrapherState?: (grapherState: GrapherState) => () => void
    /** Called with the chart's container element; returns a function to unregister */
    registerChartElement?: (element: HTMLDivElement) => () => void
    onGuidedChartLinkClick?: (href: string) => void
    registerArchiveChart?: (
        registration: ArchiveGuidedChartRegistration
    ) => () => void
    registerMultiDim?: (registrationData: {
        config: MultiDimDataPageConfig
        onSettingsChange: (
            newSettings: MultiDimDimensionChoices,
            queryParams: GrapherQueryParams
        ) => void
        grapherContainerRef: React.RefObject<HTMLDivElement | null>
    }) => void
}

export const GuidedChartContext =
    React.createContext<GuidedChartContextValue | null>(null)

/**
 * Returns a ref holding a new `GrapherState` initialized with the provided
 * config. If called within a `GuidedChartContext`, also registers the
 * `GrapherState` with it, so it can be controlled from a GuidedChart.
 */
export function useMaybeGlobalGrapherStateRef(
    config: GrapherProgrammaticInterface
): React.RefObject<GrapherState> {
    const registerGrapherState =
        React.useContext(GuidedChartContext)?.registerGrapherState
    const grapherStateRef = React.useRef<GrapherState | null>(null)

    if (grapherStateRef.current === null) {
        grapherStateRef.current = new GrapherState(config)
    }

    React.useEffect(() => {
        if (!registerGrapherState || !grapherStateRef.current) return
        return registerGrapherState(grapherStateRef.current)
    }, [registerGrapherState])

    return grapherStateRef as React.RefObject<GrapherState>
}

export function useGuidedChartLinkHandler():
    | ((href: string) => void)
    | undefined {
    const context = React.useContext(GuidedChartContext)
    return context?.onGuidedChartLinkClick
}

export const buildArchiveGuidedChartSrc = (
    registration: ArchiveGuidedChartRegistration,
    guidedUrl: Url
): string => {
    const baseUrl = Url.fromURL(registration.baseUrl)
    const mergedQuery = {
        ...registration.defaultQueryParams,
        ...guidedUrl.queryParams,
    }
    const updatedUrl = baseUrl.setQueryParams(mergedQuery)

    const hash = guidedUrl.hash || baseUrl.hash
    return hash ? updatedUrl.update({ hash }).fullUrl : updatedUrl.fullUrl
}
