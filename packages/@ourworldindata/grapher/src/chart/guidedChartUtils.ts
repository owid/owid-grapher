import * as React from "react"
import { GrapherProgrammaticInterface } from "../core/Grapher.js"
import { GrapherState } from "../core/GrapherState.js"
import { MultiDimDataPageConfig, Url } from "@ourworldindata/utils"
import {
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
    grapherStateRef: React.RefObject<GrapherState>
    chartRef?: React.RefObject<HTMLDivElement>
    onGuidedChartLinkClick?: (href: string) => void
    registerArchiveChart?: (
        registration: ArchiveGuidedChartRegistration
    ) => () => void
    registerMultiDim?: (registrationData: {
        config: MultiDimDataPageConfig
        onSettingsChange: (newSettings: MultiDimDimensionChoices) => void
        grapherContainerRef: React.RefObject<HTMLDivElement | null>
    }) => void
}

export const GuidedChartContext =
    React.createContext<GuidedChartContextValue | null>(null)

/**
 * If called within a `GuidedChartContext`, sets the context's `grapherStateRef`
 * to a new `GrapherState` instance initialized with the provided config.
 * If no context is available, returns a local ref initialized with the config.
 * This is so the `GrapherState` can be controlled from a GuidedChart,
 * but also allows for local usage when not
 */
export function useMaybeGlobalGrapherStateRef(
    config: GrapherProgrammaticInterface
): React.RefObject<GrapherState> {
    const context = React.useContext(GuidedChartContext)
    const localRef = React.useRef<GrapherState | null>(null)

    // If a context is provided, use it; otherwise, use the local ref
    const refToUse = context?.grapherStateRef || localRef

    // Only initialize if the ref is empty
    if (!refToUse.current) {
        refToUse.current = new GrapherState(config)
    }

    return refToUse as React.RefObject<GrapherState>
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
