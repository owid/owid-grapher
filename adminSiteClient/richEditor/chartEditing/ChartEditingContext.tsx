import { createContext, useContext } from "react"
import type { GrapherState } from "@ourworldindata/grapher"
import type { EmbeddedEditorHost } from "./EmbeddedChartEditorHosts.js"

/**
 * An in-situ chart editing session: the embedded chart editor in the right
 * rail is editing the chart of one specific block on the canvas. The block's
 * NodeView renders the session's live grapherState (so form edits update the
 * chart in place) instead of fetching the saved config.
 */
export interface ChartEditingSession {
    kind: "chart" | "narrative-chart"
    /**
     * Current ProseMirror position of the block being edited; remapped
     * whenever the doc changes, null once the block was deleted.
     */
    blockPos: number | null
    /** chart slug (chart blocks) or narrative chart name, as a sanity check */
    identity: string
    /** fully initialized editor host (editor is constructed before a session is exposed) */
    host: EmbeddedEditorHost
}

export interface OpenChartSessionArgs {
    chartId: number
    slug: string
    blockPos: number
}

export interface OpenNarrativeChartSessionArgs {
    narrativeChartId: number
    name: string
    blockPos: number
}

export interface ChartEditingContextValue {
    session: ChartEditingSession | null
    /** true while a session is being opened (configs are fetching) */
    isOpeningSession: boolean
    openChartSession: (args: OpenChartSessionArgs) => Promise<void>
    openNarrativeChartSession: (
        args: OpenNarrativeChartSessionArgs
    ) => Promise<void>
    closeSession: () => Promise<void>
}

export const ChartEditingContext = createContext<ChartEditingContextValue>({
    session: null,
    isOpeningSession: false,
    openChartSession: async () => undefined,
    openNarrativeChartSession: async () => undefined,
    closeSession: async () => undefined,
})

export function useChartEditing(): ChartEditingContextValue {
    return useContext(ChartEditingContext)
}

/**
 * The live grapher state to render for the block at the given position, if
 * an editing session is active for exactly this block.
 */
export function useEditingSessionGrapherState(args: {
    getPos: () => number | undefined
    kind: "chart" | "narrative-chart"
    identity: string
}): GrapherState | undefined {
    const { session } = useChartEditing()
    if (!session || session.kind !== args.kind) return undefined
    if (session.blockPos === null || session.blockPos !== args.getPos())
        return undefined
    // position matching is authoritative; the identity check only guards
    // against stale positions after unexpected doc changes
    if (session.identity !== args.identity) return undefined
    return session.host.editor?.grapherState
}
