import { GRAPHER_PREVIEW_CLASS } from "@ourworldindata/types"
import { GrapherFigureView } from "./GrapherFigureView.js"
import cx from "classnames"
import GrapherImage from "./GrapherImage.js"
import { useEffect, useState } from "react"
import { useInView } from "react-intersection-observer"
import { GrapherInterface } from "@ourworldindata/types"

export interface GrapherWithFallbackProps {
    slug: string
    className?: string
    id?: string
    enablePopulatingUrlParams?: boolean
    config: Partial<GrapherInterface>
    queryStr?: string
    fetchConfigForSlug?: boolean
}

// TODO: change this so it's possible to hand a full grapher config down (and maybe an extra config?)

export function GrapherWithFallback(
    props: GrapherWithFallbackProps
): JSX.Element {
    const { slug, className, id, config, queryStr, fetchConfigForSlug } = props
    const fetchConfig = fetchConfigForSlug ?? true

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
                enablePopulatingUrlParams={enablePopulatingUrlParams}
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
                    slug={fetchConfig ? slug : undefined}
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
