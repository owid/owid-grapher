import { useMemo } from "react"
import { Region } from "@ourworldindata/utils"
import {
    EntityName,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_NAMES,
    GrapherChartType,
    GrapherValuesJson,
    GrapherValuesJsonDataPoint,
    TimeBounds,
} from "@ourworldindata/types"
import { SearchChartHit } from "./searchTypes.js"
import {
    constructChartUrl,
    constructChartInfoUrl,
    fetchJson,
    pickEntitiesForChartHit,
    toGrapherQueryParams,
} from "./searchUtils.js"
import { HitAttributeHighlightResult } from "instantsearch.js"
import { GrapherTabIcon } from "@ourworldindata/components"
import { useIntersectionObserver } from "usehooks-ts"
import { chartHitQueryKeys } from "./queries.js"
import { useQuery } from "@tanstack/react-query"
import {
    makeLabelForGrapherTab,
    WORLD_ENTITY_NAME,
    CHART_TYPES_THAT_SWITCH_TO_DISCRETE_BAR_WHEN_SINGLE_TIME,
} from "@ourworldindata/grapher"
import {
    SearchChartHitDataDisplay,
    SearchChartHitDataDisplayProps,
} from "./SearchChartHitDataDisplay.js"
import { match } from "ts-pattern"
import { SearchChartHitHeader } from "./SearchChartHitHeader.js"

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

    const dataDisplayProps = buildDataDisplayProps({
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

                        return (
                            <a
                                key={tab}
                                href={constructChartUrl({ hit, grapherParams })}
                                onClick={onClick}
                                aria-label={makeLabelForGrapherTab(tab, {
                                    format: "long",
                                })}
                            >
                                <GrapherTabIcon tab={tab} />
                            </a>
                        )
                    })}
                </div>
            </div>
            {dataDisplayProps && (
                <SearchChartHitDataDisplay {...dataDisplayProps} />
            )}
        </article>
    )
}

// Generates time bounds to force line charts to display properly in previews.
// When start and end times are the same (single time point), line charts
// automatically switch to discrete bar charts. To prevent that, we set the start
// time to -Infinity, which refers to the earliest available data.
function getTimeBoundsForChartUrl(
    chartInfo?: GrapherValuesJson | null
): { timeBounds: TimeBounds; timeMode: "year" | "day" } | undefined {
    if (!chartInfo) return undefined

    const { startTime, endTime } = chartInfo

    // When a chart has different start and end times, we don't need to adjust
    // the time parameter because the chart will naturally display as a line chart.
    // Note: `chartInfo` is fetched for the _default_ view. If startTime equals
    // endTime here, it doesn't necessarily mean that the line chart is actually
    // single-time, since we're looking at the default tab rather than the specific
    // line chart tab. However, false positives are generally harmless because most
    // charts don't customize their start time.
    if (startTime && startTime !== endTime) return undefined

    const columnSlug = chartInfo.endTimeValues?.y[0].columnSlug ?? ""
    const columnInfo = chartInfo.columns?.[columnSlug]

    return {
        timeBounds: [-Infinity, endTime ?? Infinity],
        timeMode: columnInfo?.yearIsDay ? "day" : "year",
    }
}

function findDatapoint(
    chartInfo: GrapherValuesJson | undefined,
    time: "end" | "start" = "end"
): GrapherValuesJsonDataPoint | undefined {
    if (!chartInfo) return undefined

    const yDims = match(time)
        .with("end", () => chartInfo.endTimeValues?.y)
        .with("start", () => chartInfo.startTimeValues?.y)
        .exhaustive()
    if (!yDims) return undefined

    // Make sure we're not showing a projected data point
    const historicalDims = yDims.filter(
        (dim) => !chartInfo.columns?.[dim.columnSlug]?.isProjection
    )

    // Don't show a data value for charts with multiple y-indicators
    if (historicalDims.length > 1) return undefined

    return historicalDims[0]
}

function buildDataDisplayProps({
    chartInfo,
    chartType,
    entity,
    isEntityPickedByUser,
}: {
    chartInfo?: GrapherValuesJson | null
    chartType?: GrapherChartType
    entity: EntityName
    isEntityPickedByUser?: boolean
}): SearchChartHitDataDisplayProps | undefined {
    if (!chartInfo) return undefined

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

    const xSlug = chartInfo?.endTimeValues?.x?.columnSlug
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
    const showLocationIcon = isEntityPickedByUser

    return {
        entityName: entity,
        endValue,
        startValue,
        time,
        unit,
        trend,
        showLocationIcon,
    }
}
