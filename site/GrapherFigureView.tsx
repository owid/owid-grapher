import { useRef } from "react"

import {
    Grapher,
    GrapherProgrammaticInterface,
    GrapherState,
} from "@ourworldindata/grapher"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../settings/clientSettings.js"
import { useElementBounds } from "./hooks.js"

// Wrapper for Grapher that uses css on figure element to determine the bounds
export const GrapherFigureView = ({
    grapher,
    extraProps,
}: {
    grapher: Grapher
    extraProps?: Partial<GrapherProgrammaticInterface>
}) => {
    const base = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(base)

    const grapherState: GrapherState = new GrapherState({
        ...grapher.grapherState.toObject(),
        isEmbeddedInADataPage: grapher.grapherState.isEmbeddedInADataPage,
        bindUrlToWindow: grapher.grapherState.initialOptions.bindUrlToWindow,
        queryStr: grapher.grapherState.initialOptions.bindUrlToWindow
            ? window.location.search
            : "", // TODO: 2025-01-03 changed this from undefined to empty string - is this a problem?
        bounds,
        dataApiUrl: DATA_API_URL,
        enableKeyboardShortcuts: true,
        adminBaseUrl: ADMIN_BASE_URL,
        bakedGrapherURL: BAKED_GRAPHER_URL,
        ...extraProps,
    })
    return (
        // They key= in here makes it so that the chart is re-loaded when the slug changes.
        <figure data-grapher-src ref={base}>
            {bounds && (
                <Grapher key={grapherState.slug} grapherState={grapherState} />
            )}
        </figure>
    )
}
