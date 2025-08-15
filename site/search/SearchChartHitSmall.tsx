import { useMemo } from "react"
import { Region, Tippy, fetchJson } from "@ourworldindata/utils"
import {
    GRAPHER_TAB_NAMES,
    GrapherChartType,
    GrapherValuesJson,
} from "@ourworldindata/types"
import { SearchChartHit } from "./searchTypes.js"
import {
    constructChartUrl,
    constructChartInfoUrl,
    pickEntitiesForChartHit,
    toGrapherQueryParams,
    getTimeBoundsForChartUrl,
    buildChartHitDataDisplayProps,
    constructDownloadUrl,
} from "./searchUtils.js"
import { Button, GrapherTabIcon } from "@ourworldindata/components"
import { useIntersectionObserver } from "usehooks-ts"
import { chartHitQueryKeys } from "./queries.js"
import { useQuery } from "@tanstack/react-query"
import {
    makeLabelForGrapherTab,
    WORLD_ENTITY_NAME,
    CHART_TYPES_THAT_SWITCH_TO_DISCRETE_BAR_WHEN_SINGLE_TIME,
} from "@ourworldindata/grapher"
import { SearchChartHitDataDisplay } from "./SearchChartHitDataDisplay.js"
import { SearchChartHitHeader } from "./SearchChartHitHeader.js"
import { faDownload } from "@fortawesome/free-solid-svg-icons"

export function SearchChartHitSmall({
    hit,
    searchQueryRegionsMatches,
    onClick,
}: {
    hit: SearchChartHit
    searchQueryRegionsMatches?: Region[] | undefined
    // Search uses a global onClick handler to track analytics
    // But the data catalog passes a function to this component explicitly
    onClick?: () => void
}) {
    // Intersection observer for lazy loading chart info
    const { ref, isIntersecting: hasBeenVisible } = useIntersectionObserver({
        rootMargin: "400px", // Start loading 400px before visible
        freezeOnceVisible: true, // Only trigger once
    })

    const entities = useMemo(
        () => pickEntitiesForChartHit(hit, searchQueryRegionsMatches),
        [hit, searchQueryRegionsMatches]
    )

    const entityForDisplay = entities[0] ?? WORLD_ENTITY_NAME
    const hasUserPickedEntities = entities.length > 0

    // Fetch chart info and data values
    const { data: chartInfo } = useQuery({
        queryKey: chartHitQueryKeys.chartInfo(hit.slug, entities),
        queryFn: () => {
            const grapherParams = toGrapherQueryParams({
                entities: [entityForDisplay],
            })
            const url = constructChartInfoUrl({ hit, grapherParams })
            if (!url) return null
            return fetchJson<GrapherValuesJson>(url)
        },
        // Only fetch when the component is visible
        enabled: hasBeenVisible,
    })

    // The first chart tab is the primary chart type
    const chartType: GrapherChartType | undefined = hit.availableTabs.find(
        (tab) =>
            tab !== GRAPHER_TAB_NAMES.Table &&
            tab !== GRAPHER_TAB_NAMES.WorldMap
    )

    const dataDisplayProps = buildChartHitDataDisplayProps({
        chartInfo,
        chartType,
        entity: entityForDisplay,
        isEntityPickedByUser: hasUserPickedEntities,
    })

    const grapherParams = toGrapherQueryParams({ entities })
    const chartUrl = constructChartUrl({ hit, grapherParams })

    return (
        <article ref={ref} className="search-chart-hit-small">
            <div className="search-chart-hit-small__content">
                <SearchChartHitHeader
                    hit={hit}
                    url={chartUrl}
                    source={chartInfo?.source}
                    onClick={onClick}
                />
                <div className="search-chart-hit-small__tabs-container">
                    {hit.availableTabs.map((tab) => {
                        // Single-time line charts are rendered as bar charts
                        // by Grapher. Adjusting the time param makes sure
                        // Grapher actually shows a line chart. This is important
                        // since we offer separate links for going to the line
                        // chart view and the bar chart view. If we didn't do
                        // this, both links would end up going to the bar chart.
                        const timeParam =
                            CHART_TYPES_THAT_SWITCH_TO_DISCRETE_BAR_WHEN_SINGLE_TIME.includes(
                                tab as any
                            )
                                ? getTimeBoundsForChartUrl(chartInfo)
                                : undefined

                        const grapherParams = toGrapherQueryParams({
                            entities,
                            tab,
                            ...timeParam,
                        })

                        const href = constructChartUrl({ hit, grapherParams })
                        const label = makeLabelForGrapherTab(tab, {
                            format: "long",
                        })

                        return (
                            <Tippy
                                key={tab}
                                appendTo={() => document.body}
                                className="search-chart-hit-small__tippy"
                                content={label}
                                placement="bottom"
                                theme="dark"
                            >
                                <a
                                    href={href}
                                    onClick={onClick}
                                    aria-label={label}
                                >
                                    <GrapherTabIcon tab={tab} />
                                </a>
                            </Tippy>
                        )
                    })}
                </div>
            </div>
            {dataDisplayProps && (
                <SearchChartHitDataDisplay {...dataDisplayProps} />
            )}
            <Tippy
                appendTo={() => document.body}
                className="search-chart-hit-small__tippy"
                content="Download options"
                placement="bottom"
                theme="dark"
            >
                {/* Without this wrapper element, the tippy isn't positioned correctly */}
                <div className="search-chart-hit-small__download-button-wrapper">
                    <Button
                        className="search-chart-hit-small__download-button"
                        theme="solid-light-blue"
                        href={constructDownloadUrl({ hit })}
                        icon={faDownload}
                        ariaLabel="Download options"
                    />
                </div>
            </Tippy>
        </article>
    )
}
