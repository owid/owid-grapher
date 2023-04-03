import { Grapher } from "@ourworldindata/grapher"
import React from "react"
import { GrapherFigureView } from "./GrapherFigureView.js"
import { BAKED_GRAPHER_EXPORTS_BASE_URL } from "../settings/clientSettings.js"
import cx from "classnames"

export const GrapherWithFallback = ({
    grapher,
    slug,
    className,
}: {
    grapher?: Grapher | undefined
    slug?: string
    className?: string
}) => {
    return slug ? (
        <div className={cx("GrapherWithFallback", className)}>
            <>
                {grapher ? (
                    <GrapherFigureView grapher={grapher} />
                ) : (
                    // Given GrapherFigureView also renders a figure which gets
                    // the same styling and height, rendering an empty <figure>
                    // while Grapher is instanciated probably helps with
                    // cumulative layout shift (CLS)
                    <figure data-grapher-src></figure>
                )}
            </>

            <noscript className="GrapherWithFallback__fallback">
                <img src={`${BAKED_GRAPHER_EXPORTS_BASE_URL}/${slug}.svg`} />
                <p>Interactive visualization requires JavaScript</p>
            </noscript>
        </div>
    ) : null
}
