import { useRef } from "react"

import {
    FetchingGrapher,
    GrapherProgrammaticInterface,
    GrapherState,
} from "@ourworldindata/grapher"
import {
    ADMIN_BASE_URL,
    GRAPHER_DYNAMIC_CONFIG_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../settings/clientSettings.js"
import { useElementBounds } from "./hooks.js"

// Wrapper for Grapher that uses css on figure element to determine the bounds
export const GrapherFigureView = ({
    slug,
    extraProps,
}: {
    slug: string
    extraProps?: Partial<GrapherProgrammaticInterface>
}) => {
    const base = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(base)

    // TODO: Question - should FetchingGrapher take either a full config or a slug plus extra config?

    const grapherState: GrapherState = new GrapherState({
        bounds,
        enableKeyboardShortcuts: true,
        ...extraProps,
    })
    return (
        // They key= in here makes it so that the chart is re-loaded when the slug changes.
        <figure ref={base}>
            {bounds && (
                <FetchingGrapher
                    key={grapherState.slug}
                    //config={grapherState}
                    configUrl={`${GRAPHER_DYNAMIC_CONFIG_URL}/${slug}.config.json`}
                    adminBaseUrl={ADMIN_BASE_URL}
                    bakedGrapherURL={BAKED_GRAPHER_URL}
                    dataApiUrl={DATA_API_URL}
                />
            )}
        </figure>
    )
}
