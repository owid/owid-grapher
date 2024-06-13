import { Grapher, GrapherManager } from "@ourworldindata/grapher"
import React from "react"
import { GrapherFigureView } from "./GrapherFigureView.js"
import cx from "classnames"
import { GRAPHER_PREVIEW_CLASS } from "./SiteConstants.js"
import GrapherImage from "./GrapherImage.js"

export const GrapherWithFallback = ({
    grapher,
    manager,
    slug,
    className,
    id,
    getGrapherInstance,
}: {
    grapher?: Grapher | undefined
    manager?: GrapherManager
    slug?: string
    className?: string
    id?: string
    getGrapherInstance?: (grapher: Grapher) => void
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
                    <GrapherFigureView
                        grapher={grapher}
                        manager={manager}
                        getGrapherInstance={getGrapherInstance}
                    />
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
                        {slug && <GrapherImage slug={slug} />}
                    </figure>
                )}
            </>
        </div>
    )
}
