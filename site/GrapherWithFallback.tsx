import { HIDE_IF_JS_ENABLED_CLASSNAME } from "@ourworldindata/types"
import { GrapherFigureView } from "./GrapherFigureView.js"
import cx from "classnames"
import GrapherImage from "./GrapherImage.js"
import { useIntersectionObserver, useIsClient } from "usehooks-ts"
import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"

export interface GrapherWithFallbackProps {
    slug?: string
    configUrl?: string // Optional, if provided will override slug
    useProvidedConfigOnly?: boolean // If true, will not fetch config from URL
    className?: string
    id?: string
    enablePopulatingUrlParams?: boolean
    config: Partial<GrapherProgrammaticInterface>
    queryStr?: string
    isEmbeddedInAnOwidPage: boolean
    isEmbeddedInADataPage: boolean
    isPreviewing?: boolean
}

export function GrapherWithFallback(props: GrapherWithFallbackProps) {
    const { slug, className, id, config, queryStr, isPreviewing } = props

    if (!slug && !props.configUrl) {
        console.error(
            "GrapherWithFallback requires either a slug or a configUrl to be provided."
        )
    }

    const isClient = useIsClient()
    const { ref, isIntersecting: shouldLoadGrapher } = useIntersectionObserver({
        rootMargin: "400px",
        freezeOnceVisible: true,
    })

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
            {isClient && shouldLoadGrapher ? (
                <GrapherFigureView
                    slug={slug}
                    configUrl={props.configUrl}
                    config={config}
                    useProvidedConfigOnly={props.useProvidedConfigOnly}
                    queryStr={queryStr}
                    isEmbeddedInAnOwidPage={props.isEmbeddedInAnOwidPage}
                    isEmbeddedInADataPage={props.isEmbeddedInADataPage}
                    isPreviewing={isPreviewing}
                />
            ) : (
                <figure
                    className={cx(
                        "chart",
                        "GrapherWithFallback__fallback",
                        className
                    )}
                    aria-hidden={isClient}
                >
                    {!isClient &&
                        (props.configUrl ? (
                            <GrapherImage
                                className={HIDE_IF_JS_ENABLED_CLASSNAME}
                                url={props.configUrl}
                                enablePopulatingUrlParams={
                                    props.enablePopulatingUrlParams
                                }
                            />
                        ) : (
                            <GrapherImage
                                className={HIDE_IF_JS_ENABLED_CLASSNAME}
                                slug={slug!}
                                queryString={queryStr}
                                enablePopulatingUrlParams={
                                    props.enablePopulatingUrlParams
                                }
                            />
                        ))}
                </figure>
            )}
        </div>
    )
}
