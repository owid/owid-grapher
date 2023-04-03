import { Grapher, LoadingIndicator } from "@ourworldindata/grapher"
import React from "react"
import { GrapherFigureView } from "./GrapherFigureView.js"
import { BAKED_GRAPHER_EXPORTS_BASE_URL } from "../settings/clientSettings.js"

export const GrapherWithFallback = ({
    grapher,
    slug,
}: {
    grapher?: Grapher | undefined
    slug?: string
}) => {
    return slug ? (
        <>
            <>
                {grapher ? (
                    <GrapherFigureView grapher={grapher} />
                ) : (
                    <figure data-grapher-src={`/grapher/${slug}`}>
                        <LoadingIndicator />
                    </figure>
                )}
            </>

            <noscript id="fallback">
                <img src={`${BAKED_GRAPHER_EXPORTS_BASE_URL}/${slug}.svg`} />
                <p>Interactive visualization requires JavaScript</p>
            </noscript>
        </>
    ) : null
}
