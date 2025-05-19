import { GRAPHER_PREVIEW_CLASS, GrapherInterface } from "@ourworldindata/types"
import { GrapherFigureView } from "./GrapherFigureView.js"
import cx from "classnames"
import GrapherImage from "./GrapherImage.js"
import { useIntersectionObserver, useIsClient } from "usehooks-ts"

export interface GrapherWithFallbackProps {
    slug: string
    className?: string
    id?: string
    enablePopulatingUrlParams?: boolean
    config: Partial<GrapherInterface>
    queryStr?: string
}

export function GrapherWithFallback(
    props: GrapherWithFallbackProps
): JSX.Element {
    const { slug, className, id, config, queryStr } = props

    const isClient = useIsClient()
    const { ref, isIntersecting: hasBeenVisible } = useIntersectionObserver({
        rootMargin: "400px",
        // Only trigger once
        freezeOnceVisible: true,
    })

    // Render fallback svg when javascript disabled or while
    // grapher is loading
    const imageFallback = (
        <figure
            className={cx(
                GRAPHER_PREVIEW_CLASS,
                "GrapherWithFallback__fallback"
            )}
        >
            <GrapherImage
                slug={slug}
                enablePopulatingUrlParams={props.enablePopulatingUrlParams}
            />
        </figure>
    )

    return (
        <div
            className={cx(
                "GrapherWithFallback",
                "full-width-on-mobile",
                className
            )}
            id={id}
            ref={ref}
        >
            {!isClient ? (
                imageFallback
            ) : hasBeenVisible ? (
                <GrapherFigureView
                    slug={slug}
                    config={config}
                    queryStr={queryStr}
                />
            ) : (
                // Optional loading placeholder while waiting to come into view
                imageFallback
            )}
        </div>
    )
}
