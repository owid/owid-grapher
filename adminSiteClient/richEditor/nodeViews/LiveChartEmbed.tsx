import { useEffect, useMemo, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import {
    FetchingGrapher,
    Grapher,
    GrapherState,
    migrateGrapherConfigToLatestVersion,
    useElementBounds,
} from "@ourworldindata/grapher"
import type { GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    CATALOG_URL,
    DATA_API_URL,
} from "../../../settings/clientSettings.js"

export interface LiveChartEmbedProps {
    /** URL to fetch the full grapher config from */
    configUrl: string
    /** react-query cache key for the config fetch */
    queryKey: readonly (string | number)[]
    /** query string (e.g. "?tab=map") applied on top of the config */
    queryStr?: string
    height: number
    /**
     * When set, an in-situ editing session owns this block: render the
     * session's grapher state directly instead of fetching the saved config.
     */
    liveGrapherState?: GrapherState
}

/**
 * A live in-page <Grapher> for the rich editor canvas (charts used to render
 * as iframes here). Modeled on the slideshow editor's SlideGrapher: config is
 * fetched client-side, data comes from the data API, and the chart fills the
 * measured container bounds.
 */
export function LiveChartEmbed(props: LiveChartEmbedProps): React.ReactElement {
    const containerRef = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(containerRef)

    const configQuery = useQuery({
        queryKey: props.queryKey,
        queryFn: async (): Promise<GrapherProgrammaticInterface> => {
            const response = await fetch(props.configUrl)
            if (!response.ok)
                throw new Error(
                    `Failed to fetch chart config (${response.status})`
                )
            const config = await response.json()
            return migrateGrapherConfigToLatestVersion(config)
        },
        staleTime: Infinity,
        enabled: !props.liveGrapherState,
    })

    const config = useMemo<GrapherProgrammaticInterface | undefined>(
        () =>
            configQuery.data
                ? {
                      ...configQuery.data,
                      bakedGrapherURL: BAKED_GRAPHER_URL,
                      adminBaseUrl: ADMIN_BASE_URL,
                      isEmbeddedInAnOwidPage: true,
                  }
                : undefined,
        [configQuery.data]
    )

    // While an editing session renders this chart, the canvas owns the
    // grapher's bounds (the standalone editor's preview pane isn't there).
    const liveGrapherState = props.liveGrapherState
    useEffect(() => {
        if (liveGrapherState && bounds) {
            liveGrapherState.externalBounds = bounds
        }
    }, [liveGrapherState, bounds])

    let contents: React.ReactNode
    if (liveGrapherState) {
        contents = <Grapher grapherState={liveGrapherState} />
    } else if (config) {
        contents = (
            <FetchingGrapher
                // remount when an invalidation refetched the config so the
                // grapher state is rebuilt from the fresh config
                key={configQuery.dataUpdatedAt}
                config={config}
                queryStr={props.queryStr}
                dataApiUrl={DATA_API_URL}
                catalogUrl={CATALOG_URL}
                archiveContext={undefined}
                externalBounds={bounds}
            />
        )
    } else if (configQuery.isError) {
        contents = (
            <div className="rich-atom-block__empty">
                Couldn’t load this chart’s config
            </div>
        )
    } else {
        contents = (
            <div
                className="rich-atom-block__placeholder"
                style={{ height: props.height }}
            >
                Loading chart…
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            className="rich-atom-block__grapher"
            style={{ height: props.height }}
        >
            {contents}
        </div>
    )
}
