import { GrapherState } from "@ourworldindata/grapher"
import {
    GrapherQueryParams,
    MultiDimDimensionChoices,
} from "@ourworldindata/types"
import { ConfigureWithAi } from "./ConfigureWithAi.js"
import {
    applyTableSortToGrapherState,
    applyViewToGrapherState,
    viewToGrapherQueryParams,
} from "./configureWithAiView.js"

// The box wired to a data page's Grapher. This module is the entry point of
// the box's lazily loaded chunk; pages import it through index.tsx.

export function ConfigureWithAiForGrapher({
    slug,
    grapherState,
}: {
    slug: string
    grapherState: GrapherState
}) {
    return (
        <ConfigureWithAi
            slug={slug}
            getQueryStr={() => grapherState.queryStr}
            applyView={(view) => applyViewToGrapherState(grapherState, view)}
        />
    )
}

export function ConfigureWithAiForMdim({
    slug,
    grapherState,
    choices,
    switchView,
}: {
    slug: string
    grapherState: GrapherState
    /** The MDim options currently shown */
    choices: MultiDimDimensionChoices
    /** Switches the page to another combination of options, then applies the Grapher params on top */
    switchView: (
        choices: MultiDimDimensionChoices,
        grapherQueryParams: GrapherQueryParams
    ) => void
}) {
    const getQueryStr = (): string => {
        const params = new URLSearchParams(choices)
        for (const [key, value] of Object.entries(grapherState.changedParams))
            if (value !== undefined) params.set(key, value)
        return "?" + params.toString()
    }
    return (
        <ConfigureWithAi
            slug={slug}
            getQueryStr={getQueryStr}
            applyView={(view) => {
                if (!view.options) return
                applyTableSortToGrapherState(grapherState, view)
                switchView(view.options, viewToGrapherQueryParams(view))
            }}
        />
    )
}
