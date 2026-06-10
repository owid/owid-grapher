import { useIntersectionObserver, useIsClient } from "usehooks-ts"
import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import {
    GRAPHER_PREVIEW_CLASS,
    HIDE_IF_JS_ENABLED_CLASSNAME,
} from "@ourworldindata/types"
import { Url, MultiDimDataPageConfig } from "@ourworldindata/utils"
import GrapherImage from "./GrapherImage.js"
import { useMultiDimConfig } from "./multiDim/hooks.js"
import MultiDim from "./multiDim/MultiDim.js"

export function MultiDimEmbed({
    url,
    chartConfig,
    isPreviewing,
}: {
    url: string
    chartConfig: Partial<GrapherProgrammaticInterface>
    isPreviewing?: boolean
}) {
    const isClient = useIsClient()
    const { ref, isIntersecting: hasBeenVisible } = useIntersectionObserver({
        rootMargin: "400px",
        freezeOnceVisible: true,
    })

    const embedUrl = Url.fromURL(url)
    const { queryStr, slug } = embedUrl
    const {
        data: config,
        error,
        isError,
    } = useMultiDimConfig({
        slug,
        isPreviewing,
        enabled: hasBeenVisible,
    })

    if (!slug) {
        return <div>Error: No slug found in URL</div>
    }

    const shouldRenderMultiDim = isClient && hasBeenVisible && config

    return (
        <div className="multi-dim-embed" ref={ref}>
            {shouldRenderMultiDim ? (
                <MultiDim
                    slug={slug}
                    config={MultiDimDataPageConfig.fromObject(config)}
                    localGrapherConfig={chartConfig}
                    queryStr={queryStr}
                    isPreviewing={isPreviewing}
                />
            ) : (
                <>
                    <figure
                        className={`${GRAPHER_PREVIEW_CLASS} GrapherWithFallback__fallback`}
                        aria-hidden={isClient}
                    >
                        {!isClient && (
                            <GrapherImage
                                className={HIDE_IF_JS_ENABLED_CLASSNAME}
                                url={url}
                            />
                        )}
                    </figure>
                    {isError ? <div>Error: {error.message}</div> : null}
                </>
            )}
        </div>
    )
}
