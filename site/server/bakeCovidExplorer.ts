import { BAKED_BASE_URL } from "settings"
import {
    fromPairs,
    flatten,
    urlToSlug,
    chartToExplorerQueryStr
} from "charts/Util"
import { covidDashboardSlug } from "charts/covidDataExplorer/CovidConstants"

interface ChartExplorerRedirect {
    id: number
    slugs: string[] // includes redirect slugs
    explorerQueryStr: string
}

export const chartExplorerRedirects: ChartExplorerRedirect[] = [
    // {
    //     id: 4018,
    //     slugs: [
    //         "total-cases-covid-19",
    //         "total-confirmed-cases-of-covid-19",
    //         "total-cases-covid-19-who"
    //     ],
    //     explorerQueryStr:
    //         "zoomToSelection=true&casesMetric=true&totalFreq=true&smoothing=0&country=OWID_WRL"
    // }
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

export function replaceChartIframesWithExplorerIframes($: CheerioStatic) {
    const grapherIframes = $("iframe")
        .toArray()
        .filter(el => (el.attribs["src"] || "").match(/\/grapher\//))
    for (const el of grapherIframes) {
        const url = el.attribs["src"].trim()
        const slug = urlToSlug(url)
        if (slug in chartExplorerRedirectsBySlug) {
            const { explorerQueryStr } = chartExplorerRedirectsBySlug[slug]
            const matchQueryStr = url.match(/\?([^#]*)/)
            const chartQueryStr = matchQueryStr ? matchQueryStr[1] : ""
            const queryStr = chartToExplorerQueryStr(
                explorerQueryStr,
                chartQueryStr
            )
            // Replace Grapher iframe src with explorer src
            el.attribs[
                "src"
            ] = `${BAKED_BASE_URL}/${covidDashboardSlug}${queryStr}`
        }
    }
}
