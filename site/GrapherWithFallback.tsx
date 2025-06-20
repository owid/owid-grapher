import { GRAPHER_PREVIEW_CLASS, GrapherInterface } from "@ourworldindata/types"
import { GrapherFigureView } from "./GrapherFigureView.js"
import cx from "classnames"
import GrapherImage from "./GrapherImage.js"
import { useIntersectionObserver, useIsClient } from "usehooks-ts"

export interface GrapherWithFallbackProps {
    slug?: string
    configUrl?: string // Optional, if provided will override slug
    className?: string
    id?: string
    enablePopulatingUrlParams?: boolean
    config: Partial<GrapherInterface>
    queryStr?: string
    isEmbeddedInAnOwidPage: boolean
    isEmbeddedInADataPage: boolean
}

export function GrapherWithFallback(
    props: GrapherWithFallbackProps
): JSX.Element {
    const { slug, className, id, config, queryStr } = props

    if (!slug && !props.configUrl) {
        console.error(
            "GrapherWithFallback requires either a slug or a configUrl to be provided."
        )
    }

    const isClient = useIsClient()
    const { ref, isIntersecting: hasBeenVisible } = useIntersectionObserver({
        rootMargin: "400px",
        // Only trigger once
        freezeOnceVisible: true,
    })

    // Render fallback png when javascript disabled or while
    // grapher is loading
    const imageFallback = (
        <figure
            className={cx(
                GRAPHER_PREVIEW_CLASS,
                "GrapherWithFallback__fallback"
            )}
        >
            {props.configUrl ? (
                <GrapherImage
                    url={props.configUrl!}
                    enablePopulatingUrlParams={props.enablePopulatingUrlParams}
                />
            ) : (
                <GrapherImage
                    slug={slug!}
                    queryString={queryStr}
                    enablePopulatingUrlParams={props.enablePopulatingUrlParams}
                />
            )}
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
                    configUrl={props.configUrl}
                    config={config}
                    queryStr={queryStr}
                    isEmbeddedInAnOwidPage={props.isEmbeddedInAnOwidPage}
                    isEmbeddedInADataPage={props.isEmbeddedInADataPage}
                />
            ) : (
                // Optional loading placeholder while waiting to come into view
                imageFallback
            )}
        </div>
    )
}
