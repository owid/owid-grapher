import { QueryStatus, useQuery } from "@tanstack/react-query"
import {
    ChartRecordType,
    EntityName,
    GrapherTabName,
    GrapherValuesJson,
    SearchChartHit,
} from "@ourworldindata/types"
import { fetchJson } from "@ourworldindata/utils"
import {
    constructChartInfoUrl,
    constructChartUrl,
    constructPreviewUrl,
    toGrapherQueryParams,
} from "./searchUtils"
import { chartHitQueryKeys } from "./queries"
import { PreviewVariant } from "./SearchChartHitRichDataTypes.js"
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
    hit: SearchChartHit
    tab: GrapherTabName
    entities?: EntityName[]
    hasScatter?: boolean
}): { chartUrl: string; previewUrl: string } {
    const grapherParams = toGrapherQueryParams({ entities, tab })

    const chartUrl = constructChartUrl({
        hit,
        grapherParams,
    })

    const imageDimensions = hasScatter
        ? calculateScatterPreviewImageDimensions()
        : undefined
    const previewUrl = constructPreviewUrl({
        hit,
        grapherParams,
        variant: PreviewVariant.Thumbnail,
        imageWidth: imageDimensions?.width,
        imageHeight: imageDimensions?.height,
    })

    return { chartUrl, previewUrl }
}
