import * as R from "remeda"
import { useMemo } from "react"
import { Region } from "@ourworldindata/utils"
import {
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_NAMES,
    GrapherChartType,
    GrapherValuesJson,
    GrapherValuesJsonDataPoint,
} from "@ourworldindata/types"
import { SearchChartHit, SearchIndexName } from "./searchTypes.js"
import {
    constructChartUrl,
    constructChartInfoUrl,
    fetchJson,
    pickEntitiesForChartHit,
} from "./searchUtils.js"
import { HitAttributeHighlightResult } from "instantsearch.js"
import { getIndexName } from "./searchClient.js"
import { Highlight } from "react-instantsearch"
import { GrapherTabIcon } from "@ourworldindata/components"
import { useIntersectionObserver } from "usehooks-ts"
import { chartHitQueryKeys } from "./queries.js"
import { useQuery } from "@tanstack/react-query"
import {
    makeLabelForGrapherTab,
    WORLD_ENTITY_NAME,
} from "@ourworldindata/grapher"
import {
    SearchChartHitDataDisplay,
    SearchChartHitDataDisplayProps,
} from "./SearchChartHitDataDisplay.js"
import { match } from "ts-pattern"

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

    const entities = useMemo(() => {
        const highlighted = (hit._highlightResult?.originalAvailableEntities ||
            hit._highlightResult?.availableEntities) as
            | HitAttributeHighlightResult[]
            | undefined
        const available = hit.originalAvailableEntities ?? hit.availableEntities

        return pickEntitiesForChartHit(
            highlighted,
            available,
            searchQueryRegionsMatches
        )
    }, [
        hit._highlightResult?.availableEntities,
        hit._highlightResult?.originalAvailableEntities,
        hit.availableEntities,
        hit.originalAvailableEntities,
        searchQueryRegionsMatches,
    ])

    // Fetch chart info and data values
    const { data: chartInfo } = useQuery({
        queryKey: chartHitQueryKeys.chartInfo(hit.slug, entities),
        queryFn: () => {
            const url = constructChartInfoUrl({ hit, entities })
            if (!url) return null
            return fetchJson<GrapherValuesJson>(url)
        },
        // Only fetch when the component is visible
        enabled: hasBeenVisible,
    })

    const chartUrl = constructChartUrl({ hit, entities })

    // The first chart tab is the primary chart type
    const chartType: GrapherChartType | undefined = hit.availableTabs.find(
        (tab) =>
            tab !== GRAPHER_TAB_NAMES.Table &&
            tab !== GRAPHER_TAB_NAMES.WorldMap
    )

    const dataDisplayProps = buildDataDisplayProps({
        chartInfo,
        chartType,
        entities,
    })

    return (
        <article ref={ref} className="search-chart-hit-small">
            <div className="search-chart-hit-small__content">
                <a
                    href={chartUrl}
                    className="search-chart-hit-small__title-link"
                    onClick={onClick}
                    data-algolia-index={getIndexName(
                        SearchIndexName.ExplorerViewsMdimViewsAndCharts
                    )}
                    data-algolia-object-id={hit.objectID}
                    data-algolia-position={hit.__position}
                >
                    <header className="search-chart-hit-small__header">
                        <div className="search-chart-hit-small__title-container">
                            <h3 className="search-chart-hit-small__title">
                                {hit.title}
                            </h3>
                            {chartInfo?.source && (
                                <span className="search-chart-hit-small__source">
                                    {chartInfo.source}
                                </span>
                            )}
                        </div>
                        <Highlight
                            hit={hit}
                            attribute="subtitle"
                            highlightedTagName="strong"
                            classNames={{
                                root: "search-chart-hit-small__subtitle",
                            }}
                        />
                    </header>
                </a>
                <div className="search-chart-hit-small__tabs-container">
                    {hit.availableTabs.map((tab) => (
                        <a
                            key={tab}
                            href={constructChartUrl({ hit, entities, tab })}
                            onClick={onClick}
                            aria-label={makeLabelForGrapherTab(tab)}
                        >
                            <GrapherTabIcon tab={tab} />
                        </a>
                    ))}
                </div>
            </div>
            {dataDisplayProps && (
                <SearchChartHitDataDisplay {...dataDisplayProps} />
            )}
        </article>
    )
}

function findDatapoint(
    chartInfo: GrapherValuesJson | undefined,
    time: "end" | "start" = "end"
): GrapherValuesJsonDataPoint | undefined {
    if (!chartInfo) return undefined

    const yDims = match(time)
        .with("end", () => chartInfo.endTime?.y)
        .with("start", () => chartInfo.startTime?.y)
        .exhaustive()
    if (!yDims) return undefined

    const [projDims, histDims] = R.partition(
        yDims,
        (dim) => !!chartInfo.columns?.[dim.columnSlug]?.isProjection
    )

    // Don't show a data value for charts with multiple y-indicators
    if (historicalDims.length > 1) return undefined

    // Don't show a data point if there's more than one dimension
    if (histDims.length > 1) return undefined
    const histDim = histDims[0]

    // If there is a projection, then prefer the historical data point if it exists.
    // Otherwise, return the projected data point but only if there's only one projected dimension.
    if (projDims.length > 0) {
        if (histDim.value !== undefined) return histDim
        if (projDims.length > 1) return undefined
        return projDims[0]
    }

    return histDim
}

function buildDataDisplayProps({
    chartInfo,
    chartType,
    entities,
}: {
    chartInfo?: GrapherValuesJson | null
    chartType?: GrapherChartType
    entities?: string[]
}): SearchChartHitDataDisplayProps | undefined {
    if (!chartInfo) return undefined

    const entityName = entities?.[0] ?? WORLD_ENTITY_NAME

    // Showing a time range only makes sense for slope charts and connected scatter plots
    const showTimeRange =
        chartType === GRAPHER_CHART_TYPES.SlopeChart ||
        chartType === GRAPHER_CHART_TYPES.ScatterPlot

    const endDatapoint = findDatapoint(chartInfo, "end")
    const startDatapoint = showTimeRange
        ? findDatapoint(chartInfo, "start")
        : undefined
    const columnInfo = endDatapoint?.columnSlug
        ? chartInfo?.columns?.[endDatapoint?.columnSlug]
        : undefined

    if (!endDatapoint?.formattedValueShort || !endDatapoint?.formattedTime)
        return undefined

    const xSlug = chartInfo?.values?.endTime?.x?.columnSlug
    const xColumnInfo = chartInfo?.columns?.[xSlug ?? ""]
    const hasDataDisplay =
        // For scatter plots, displaying a single data value is ambiguous since
        // they have two dimensions. But we do show a data value if the x axis
        // is GDP since then it's sufficiently clear
        chartType !== GRAPHER_TAB_NAMES.ScatterPlot ||
        /GDP/.test(xColumnInfo?.name ?? "")

    if (!hasDataDisplay) return undefined

    const endValue = endDatapoint.valueLabel ?? endDatapoint.formattedValueShort
    const startValue =
        startDatapoint?.valueLabel ?? startDatapoint?.formattedValueShort
    const unit =
        columnInfo?.unit && columnInfo?.unit !== columnInfo?.shortUnit
            ? columnInfo?.unit
            : undefined
    const time = startDatapoint?.formattedTime
        ? `${startDatapoint?.formattedTime}–${endDatapoint.formattedTime}`
        : endDatapoint.formattedTime
    const trend =
        startDatapoint?.value !== undefined && endDatapoint?.value !== undefined
            ? endDatapoint.value > startDatapoint.value
                ? "up"
                : endDatapoint.value < startDatapoint.value
                  ? "down"
                  : "right"
            : undefined

    return { entityName, endValue, startValue, time, unit, trend }
}
