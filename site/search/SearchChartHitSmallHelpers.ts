import { QueryStatus, useQuery } from "@tanstack/react-query"
import {
    ChartLabelMode,
    ChartRecordType,
    EntityName,
    GrapherVariant,
    GrapherTabName,
    GrapherValuesJson,
    SearchChartHit,
    SearchChartUrlTarget,
} from "@ourworldindata/types"
import { fetchJson } from "@ourworldindata/utils"
import {
    constructChartInfoUrl,
    constructChartUrl,
    constructPreviewUrl,
    toGrapherQueryParams,
} from "./searchUtils"
import { chartHitQueryKeys } from "./queries"
import { calculateScatterPreviewImageDimensions } from "./SearchChartHitRichDataHelpers.js"

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
    const isChartRecord = hit.type === ChartRecordType.Chart

    const { data, status } = useQuery({
        queryKey: chartHitQueryKeys.chartInfo(
            hit.slug,
            entities,
            isChartRecord ? undefined : hit.queryParams
        ),
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
    entities,
    hasScatter = false,
}: {
    hit: SearchChartUrlTarget
    tab: GrapherTabName
    entities?: EntityName[]
    hasScatter?: boolean
}): { chartUrl: string; previewUrl: string } {
    const grapherParams = toGrapherQueryParams({ entities, tab })

    const chartUrl = constructChartUrl({
        hit,
        grapherParams,
    })

    const previewUrl = constructPreviewUrl({
        hit,
        grapherParams,
        imageRequest: {
            variant: GrapherVariant.Thumbnail,
            labelMode: ChartLabelMode.All,
            size: {
                kind: "explicit",
                ...(hasScatter && calculateScatterPreviewImageDimensions()),
            },
            includeDetails: false,
        },
    })

    return { chartUrl, previewUrl }
}
