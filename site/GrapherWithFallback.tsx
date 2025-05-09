import { GRAPHER_PREVIEW_CLASS, GrapherInterface } from "@ourworldindata/types"
import { GrapherFigureView } from "./GrapherFigureView.js"
import cx from "classnames"
import GrapherImage from "./GrapherImage.js"
import { useEffect, useState } from "react"
import { useInView } from "react-intersection-observer"

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

    const [isClient, setIsClient] = useState(false)
    const { ref, inView } = useInView({
        rootMargin: "400px",
        // Only trigger once
        triggerOnce: true,
    })
    useEffect(() => {
        setIsClient(true)
    }, [])

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
            ) : inView ? (
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
