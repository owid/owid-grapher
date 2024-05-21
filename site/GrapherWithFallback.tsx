import {
    DEFAULT_GRAPHER_HEIGHT,
    DEFAULT_GRAPHER_WIDTH,
    Grapher,
} from "@ourworldindata/grapher"
import React from "react"
import { GrapherFigureView } from "./GrapherFigureView.js"
import { BAKED_GRAPHER_EXPORTS_BASE_URL } from "../settings/clientSettings.js"
import cx from "classnames"

export const GrapherWithFallback = ({
    grapher,
    slug,
    className,
    id,
}: {
    grapher?: Grapher | undefined
    slug?: string
    className?: string
    id?: string
}) => {
    return (
        <div
            className={cx(
                "GrapherWithFallback",
                "full-width-on-mobile",
                className
            )}
            id={id}
        >
            <>
                {grapher ? (
                    <GrapherFigureView grapher={grapher} />
                ) : (
                    // Render fallback svg when javascript disabled or while
                    // grapher is loading
                    <figure
                        data-grapher-src
                        className="GrapherWithFallback__fallback"
                    >
                        <img
                            src={`${BAKED_GRAPHER_EXPORTS_BASE_URL}/${
                                slug ?? ""
                            }.svg`}
                            width={DEFAULT_GRAPHER_WIDTH}
                            height={DEFAULT_GRAPHER_HEIGHT}
                            loading="lazy"
                        />
                    </figure>
                )}
            </>
        </div>
    )
}
