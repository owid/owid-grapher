import { QueryStatus, useQuery } from "@tanstack/react-query"
import {
    EntityName,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    GrapherValuesJson,
} from "@ourworldindata/types"
import { fetchJson } from "@ourworldindata/utils"
import {
    CHART_TYPES_THAT_SWITCH_TO_DISCRETE_BAR_WHEN_SINGLE_TIME,
    generateFocusedSeriesNamesParam,
    generateSelectedEntityNamesParam,
    WORLD_ENTITY_NAME,
} from "@ourworldindata/grapher"
import { SearchChartHit } from "./searchTypes"
import {
    constructChartInfoUrl,
    constructChartUrl,
    constructPreviewUrl,
    getTimeBoundsForChartUrl,
    toGrapherQueryParams,
} from "./searchUtils"
import { chartHitQueryKeys } from "./queries"
import { PreviewVariant } from "./SearchChartHitRichDataTypes.js"

export function useQueryChartInfo({
    hit,
    entities,
    enabled,
}: {
    hit: SearchChartHit
    entities: EntityName[]
    enabled?: boolean
}): {
    data?: GrapherValuesJson
    status: QueryStatus
} {
    const { data, status } = useQuery({
        queryKey: chartHitQueryKeys.chartInfo(hit.slug, entities),
        queryFn: () => {
            const entityParam = toGrapherQueryParams({ entities })
            const url = constructChartInfoUrl({
                hit,
                grapherParams: entityParam,
            })
            if (!url) return null
            return fetchJson<GrapherValuesJson>(url)
        },
        enabled,
    })

    // If the result is null, the query URL couldn't be constructed. In this
    // case, return an error status instead of a success status with null data
    if (data === null) return { status: "error" }

    return { data, status }
}

export function constructChartAndPreviewUrlsForTab({
    hit,
    tab,
    chartInfo,
    entities,
}: {
    hit: SearchChartHit
    tab: GrapherTabName
    chartInfo?: GrapherValuesJson
    entities?: EntityName[]
}): { chartUrl: string; previewUrl: string } {
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

    // If the discrete bar chart renders a single entity, try adding World.
    // Note that World might not exist in the data, in which case it will be ignored.
    if (
        tab === GRAPHER_TAB_NAMES.DiscreteBar &&
        entities?.length === 1 &&
        entities[0] !== WORLD_ENTITY_NAME
    ) {
        grapherParams.country = generateSelectedEntityNamesParam([
            ...entities,
            WORLD_ENTITY_NAME,
        ])
        grapherParams.focus = generateFocusedSeriesNamesParam(entities)
    }

    const chartUrl = constructChartUrl({
        hit,
        grapherParams,
    })
    const previewUrl = constructPreviewUrl({
        hit,
        grapherParams,
        variant: PreviewVariant.Thumbnail,
    })

    return { chartUrl, previewUrl }
}
