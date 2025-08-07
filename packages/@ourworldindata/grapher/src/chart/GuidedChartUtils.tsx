import * as React from "react"
import { GrapherProgrammaticInterface, GrapherState } from "../core/Grapher.js"
import { MultiDimDataPageConfig } from "@ourworldindata/utils"
import { MultiDimDimensionChoices } from "@ourworldindata/types"

export interface GuidedChartContextValue {
    grapherStateRef: React.RefObject<GrapherState>
    chartRef?: React.RefObject<HTMLDivElement>
    onGuidedChartLinkClick?: (href: string) => void
    registerMultiDim?: (registrationData: {
        config: MultiDimDataPageConfig
        updater: (newSettings: MultiDimDimensionChoices) => void
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
