import { Grapher } from "@ourworldindata/grapher"
import { GRAPHER_PREVIEW_CLASS } from "@ourworldindata/types"
import React from "react"
import { GrapherFigureView } from "./GrapherFigureView.js"
import cx from "classnames"
import GrapherImage from "./GrapherImage.js"

export const GrapherWithFallback = ({
    grapher,
    slug,
    className,
    id,
    enablePopulatingUrlParams = false,
}: {
    grapher?: Grapher | undefined
    slug?: string
    className?: string
    id?: string
    enablePopulatingUrlParams?: boolean
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
                        className={cx(
                            GRAPHER_PREVIEW_CLASS,
                            "GrapherWithFallback__fallback"
                        )}
                    >
                        {slug && (
                            <GrapherImage
                                slug={slug}
                                enablePopulatingUrlParams={
                                    enablePopulatingUrlParams
                                }
                            />
                        )}
                    </figure>
                )}
            </>
        </div>
    )
}
