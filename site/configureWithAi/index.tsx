import { useMemo, useState, type ReactNode } from "react"
import {
    GrapherState,
    GuidedChartContext,
    type GuidedChartContextValue,
} from "@ourworldindata/grapher"
import { useSidePanel } from "./useSidePanel.js"

// "Configure with AI" prototype (staging only). Data pages import only this
// module and useSidePanel.ts; the rest loads in a separate chunk and goes
// into Grapher's side panel, next to the entity selector.

/**
 * Wraps a single-chart data page's Grapher. The Grapher registers its state
 * through GuidedChartContext, which is how the side panel gets installed.
 */
export function WithConfigureWithAi({
    slug,
    children,
}: {
    slug: string
    children: ReactNode
}) {
    const [grapherState, setGrapherState] = useState<GrapherState | null>(null)
    const context: GuidedChartContextValue = useMemo(
        () => ({
            registerGrapherState: (state) => {
                setGrapherState(state)
                return () =>
                    setGrapherState((current) =>
                        current === state ? null : current
                    )
            },
        }),
        []
    )
    useSidePanel(grapherState, (chunk, state) =>
        chunk.createGrapherSidePanel(slug, state)
    )
    return (
        <GuidedChartContext.Provider value={context}>
            {children}
        </GuidedChartContext.Provider>
    )
}
