import React, { useMemo, useRef } from "react"
import cx from "classnames"
import { FetchingGrapher, useElementBounds } from "@ourworldindata/grapher"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    CATALOG_URL,
    DATA_API_URL,
} from "../../settings/clientSettings.js"
import { getSlideshowGrapherConfig } from "./slideshowUtils.js"

/**
 * Simple grapher wrapper for the baked site / preview.
 * Renders a FetchingGrapher with the correct config and query string.
 * No interactivity hooks, no query string tracking, no MobX reactions.
 */
export function SiteSlideGrapher(props: {
    configUrl: string
    queryStr?: string
    interactiveCharts?: boolean
}): React.ReactElement {
    const { configUrl, queryStr, interactiveCharts } = props
    const containerRef = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(containerRef)

    const grapherConfig = useMemo(
        () => ({
            bakedGrapherURL: BAKED_GRAPHER_URL,
            adminBaseUrl: ADMIN_BASE_URL,
            ...getSlideshowGrapherConfig({
                interactiveCharts: interactiveCharts ?? false,
            }),
        }),
        [interactiveCharts]
    )

    return (
        <div
            ref={containerRef}
            className={cx("slideshow-slide__grapher-container", {
                "slideshow-slide__grapher-container--non-interactive":
                    !interactiveCharts,
            })}
        >
            <FetchingGrapher
                config={grapherConfig}
                configUrl={configUrl}
                dataApiUrl={DATA_API_URL}
                catalogUrl={CATALOG_URL}
                archiveContext={undefined}
                queryStr={queryStr}
                externalBounds={bounds}
            />
        </div>
    )
}
