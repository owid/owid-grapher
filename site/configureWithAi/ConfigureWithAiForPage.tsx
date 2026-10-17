import type { GrapherState, SidePanelRenderer } from "@ourworldindata/grapher"
import type {
    GrapherQueryParams,
    MultiDimDimensionChoices,
} from "@ourworldindata/types"
import { SidePanelTabs } from "./SidePanelTabs.js"
import { PanelStore } from "./configureWithAiStore.js"
import {
    applyTableSortToGrapherState,
    applyViewToGrapherState,
    restoreGrapherState,
    snapshotGrapherState,
    viewToGrapherQueryParams,
} from "./configureWithAiView.js"

// Entry point of the lazily loaded chunk: builds the side panel renderer that
// site/configureWithAi/index.tsx installs on a data page's Grapher.

export interface SidePanel {
    renderer: SidePanelRenderer
    store: PanelStore
}

const sidePanelFor = (store: PanelStore): SidePanel => ({
    store,
    renderer: ({ entitySelector }) => (
        <SidePanelTabs store={store} entitySelector={entitySelector} />
    ),
})

export function createGrapherSidePanel(
    slug: string,
    grapherState: GrapherState
): SidePanel {
    const start = snapshotGrapherState(grapherState)
    return sidePanelFor(
        new PanelStore({
            slug,
            getQueryStr: () => grapherState.queryStr,
            applyView: (view) => applyViewToGrapherState(grapherState, view),
            restoreStart: () => restoreGrapherState(grapherState, start),
        })
    )
}

export interface MdimPage {
    slug: string
    grapherState: GrapherState
    /** The options currently shown */
    getChoices: () => MultiDimDimensionChoices
    /** Switches the page to another combination of options, then applies the Grapher params on top */
    switchView: (
        choices: MultiDimDimensionChoices,
        grapherQueryParams: GrapherQueryParams
    ) => void
}

export function createMdimSidePanel(page: MdimPage): SidePanel {
    const { slug, grapherState, getChoices, switchView } = page
    const startChoices = getChoices()
    const start = snapshotGrapherState(grapherState)
    return sidePanelFor(
        new PanelStore({
            slug,
            getQueryStr: () => {
                const params = new URLSearchParams(getChoices())
                for (const [key, value] of Object.entries(
                    grapherState.changedParams
                ))
                    if (value !== undefined) params.set(key, value)
                return "?" + params.toString()
            },
            applyView: (view) => {
                if (!view.options) return
                applyTableSortToGrapherState(grapherState, view)
                switchView(view.options, viewToGrapherQueryParams(view))
            },
            restoreStart: () => {
                grapherState.dataTableSort = start.dataTableSort
                switchView(startChoices, start.params)
            },
        })
    )
}
