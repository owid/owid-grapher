import { queryParamsToStr, strToQueryParams } from "utils/client/url"
import { fromPairs, flatten } from "charts/Util"

interface ChartExplorerRedirect {
    id: number
    slugs: string[] // includes redirect slugs
    explorerQueryStr: string
}

export const chartExplorerRedirects: ChartExplorerRedirect[] = [
    {
        id: 4018,
        slugs: [
            "total-cases-covid-19",
            "total-confirmed-cases-of-covid-19",
            "total-cases-covid-19-who"
        ],
        explorerQueryStr:
            "zoomToSelection=true&casesMetric=true&totalFreq=true&smoothing=0&hideControls=true&country=OWID_WRL"
    }
]

export const chartExplorerRedirectsBySlug: Record<
    string,
    ChartExplorerRedirect
> = fromPairs(
    flatten(
        chartExplorerRedirects.map(redirect =>
            redirect.slugs.map(slug => [slug, redirect])
        )
    )
)

export function chartToExplorerQueryStr(
    explorerQueryStr?: string,
    chartQueryStr?: string
) {
    return queryParamsToStr({
        ...strToQueryParams(explorerQueryStr ?? ""),
        ...strToQueryParams(chartQueryStr ?? ""),
        // Always hide controls when redirecting chart to explorer
        hideControls: "true"
    })
}
