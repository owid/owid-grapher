import { BAKED_BASE_URL } from "settings"
import { fromPairs, flatten, urlToSlug, mergeQueryStr } from "charts/Util"
import { covidDashboardSlug } from "charts/covidDataExplorer/CovidConstants"

interface ChartExplorerRedirect {
    id: number
    slugs: string[] // includes redirect slugs
    explorerQueryStr: string
}

/**
 * The chart IDs are not used anywhere, they are here just for reference.
 * We need to include any slug changes below that may happen after deploying this.
 * We are manually tracking the slugs because deleting/unpublishing a chart automatically
 * deletes all chart redirects (old slugs).
 */
export const chartExplorerRedirects: ChartExplorerRedirect[] = [
    {
        id: 4018,
        slugs: [
            "total-cases-covid-19",
            "total-confirmed-cases-of-covid-19",
            "total-cases-covid-19-who"
        ],
        explorerQueryStr:
            "zoomToSelection=true&casesMetric=true&totalFreq=true&smoothing=0&country=~OWID_WRL"
    },
    {
        id: 4019,
        slugs: [
            "daily-cases-covid-19",
            "daily-new-confirmed-cases-of-covid-19",
            "daily-cases-covid-19-who"
        ],
        explorerQueryStr:
            "zoomToSelection=true&casesMetric=true&dailyFreq=true&smoothing=0&country=~OWID_WRL"
    },
    {
        id: 4020,
        slugs: ["total-deaths-covid-19", "total-deaths-covid-19-who"],
        explorerQueryStr:
            "zoomToSelection=true&deathsMetric=true&totalFreq=true&smoothing=0&country=~OWID_WRL"
    },
    {
        id: 4021,
        slugs: [
            "daily-deaths-covid-19",
            "daily-new-confirmed-deaths-due-to-covid-19",
            "daily-deaths-covid-19-who"
        ],
        explorerQueryStr:
            "zoomToSelection=true&deathsMetric=true&dailyFreq=true&smoothing=0&country=~OWID_WRL"
    },
    {
        id: 4025,
        slugs: ["covid-confirmed-cases-per-million-since-1-per-million"],
        explorerQueryStr:
            "yScale=log&zoomToSelection=true&casesMetric=true&totalFreq=true&aligned=true&perCapita=true&smoothing=0&country="
    },
    {
        id: 4037,
        slugs: [
            "covid-confirmed-deaths-since-5th-death",
            "covid-confirmed-deaths-since-10th-death"
        ],
        explorerQueryStr:
            "yScale=log&zoomToSelection=true&deathsMetric=true&totalFreq=true&aligned=true&smoothing=0&country="
    },
    {
        id: 4039,
        slugs: [
            "covid-confirmed-cases-since-100th-case",
            "covid-tests-since-100th-case"
        ],
        explorerQueryStr:
            "yScale=log&zoomToSelection=true&casesMetric=true&totalFreq=true&aligned=true&smoothing=0&country="
    },
    {
        id: 4049,
        slugs: ["case-fatality-rate-covid-19"],
        explorerQueryStr:
            "zoomToSelection=true&time=2020-03-14..&cfrMetric=true&totalFreq=true&aligned=true&smoothing=0&country=OWID_WRL~USA~ITA~BRA~ESP~SWE~DEU~IND~IRN"
    },
    {
        id: 4056,
        slugs: ["coronavirus-cfr"],
        explorerQueryStr:
            "zoomToSelection=true&time=2020-03-14..&cfrMetric=true&totalFreq=true&aligned=true&smoothing=0&country=OWID_WRL~USA~ITA~BRA~ESP~SWE~DEU~IND~IRN"
    },
    {
        id: 4057,
        slugs: ["covid-deaths-days-since-per-million"],
        explorerQueryStr:
            "yScale=log&zoomToSelection=true&minPopulationFilter=1000000&deathsMetric=true&totalFreq=true&aligned=true&perCapita=true&smoothing=0&country="
    },
    {
        id: 4063,
        slugs: [
            "covid-confirmed-daily-cases-epidemiological-trajectory",
            "covid-confirmed-daily-cases-since-100th-case"
        ],
        explorerQueryStr:
            "yScale=log&zoomToSelection=true&minPopulationFilter=1000000&casesMetric=true&dailyFreq=true&aligned=true&smoothing=7&country="
    },
    {
        id: 4078,
        slugs: ["covid-confirmed-daily-deaths-epidemiological-trajectory"],
        explorerQueryStr:
            "yScale=log&zoomToSelection=true&minPopulationFilter=1000000&deathsMetric=true&dailyFreq=true&aligned=true&smoothing=7&country="
    },
    {
        id: 4101,
        slugs: ["covid-confirmed-cases-since-100th-case"],
        explorerQueryStr:
            "yScale=log&zoomToSelection=true&casesMetric=true&totalFreq=true&aligned=true&smoothing=0&country="
    },
    {
        id: 4106,
        slugs: ["covid-daily-deaths-trajectory-per-million"],
        explorerQueryStr:
            "yScale=log&zoomToSelection=true&minPopulationFilter=1000000&deathsMetric=true&dailyFreq=true&aligned=true&perCapita=true&smoothing=7&country="
    },
    {
        id: 4107,
        slugs: ["covid-daily-cases-trajectory-per-million"],
        explorerQueryStr:
            "yScale=log&zoomToSelection=true&minPopulationFilter=1000000&casesMetric=true&dailyFreq=true&aligned=true&perCapita=true&smoothing=7&country="
    },
    {
        id: 4129,
        slugs: ["total-tests-per-thousand-since-per-cap-death-threshold"],
        explorerQueryStr:
            "yScale=log&zoomToSelection=true&testsMetric=true&totalFreq=true&aligned=true&perCapita=true&smoothing=0&country="
    }
].map(redirect => ({
    ...redirect,
    // Ensure all have hideControls=true, unless specified otherwise.
    explorerQueryStr: mergeQueryStr(
        "hideControls=true",
        redirect.explorerQueryStr
    )
}))

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
            const queryStr = mergeQueryStr(explorerQueryStr, chartQueryStr)
            // Replace Grapher iframe src with explorer src
            el.attribs[
                "src"
            ] = `${BAKED_BASE_URL}/${covidDashboardSlug}${queryStr}`
        }
    }
}
