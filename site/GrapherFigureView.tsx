import React, { useRef } from "react"

import { Grapher, GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../settings/clientSettings.js"
import { useElementBounds } from "./hooks.js"

// Wrapper for Grapher that uses css on figure element to determine the bounds
export const GrapherFigureView = ({
    grapher,
    dataApiUrlForAdmin,
}: {
    grapher: Grapher
    dataApiUrlForAdmin?: string
}) => {
    const base = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(base)

    const props: GrapherProgrammaticInterface = {
        ...grapher.toObject(),
        isEmbeddedInADataPage: grapher.isEmbeddedInADataPage,
        bindUrlToWindow: grapher.props.bindUrlToWindow,
        queryStr: grapher.props.bindUrlToWindow
            ? window.location.search
            : undefined,
        bounds,
        dataApiUrl: DATA_API_URL,
        dataApiUrlForAdmin,
        enableKeyboardShortcuts: true,
    }
    return (
        // They key= in here makes it so that the chart is re-loaded when the slug changes.
        <figure data-grapher-src ref={base}>
            {bounds && (
                <Grapher
                    key={props.slug}
                    {...props}
                    adminBaseUrl={ADMIN_BASE_URL}
                    bakedGrapherURL={BAKED_GRAPHER_URL}
                />
            )}
        </figure>
    )
}
