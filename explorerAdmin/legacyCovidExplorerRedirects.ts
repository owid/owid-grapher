import { BAKED_BASE_URL } from "settings"
import { urlToSlug, mergeQueryStr } from "clientUtils/Util"
import { CoreTable } from "coreTable/CoreTable"
import {
    ExplorerProgram,
    EXPLORER_FILE_SUFFIX,
} from "../explorer/ExplorerProgram"
import { getExplorerFromFile } from "./ExplorerBaker"

// Todo: remove this file eventually. Would server side redirects do it?
// this runs only at bake/wordpress/dev time and is not a clientside file.

// todo: remove
export const legacyCovidDashboardSlug = "coronavirus-data-explorer"

/**
 * We need to include any slug changes below that may happen after deploying this.
 * We are manually tracking the slugs because deleting/unpublishing a grapher automatically
 * deletes all grapher redirects (old slugs).
 */
const redirectTableTsv = `id	slug	explorerQueryStr
4018	total-cases-covid-19	zoomToSelection=true&casesMetric=true&totalFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true
4018	total-confirmed-cases-of-covid-19	zoomToSelection=true&casesMetric=true&totalFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true
4018	total-cases-covid-19-who	zoomToSelection=true&casesMetric=true&totalFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true
4019	daily-cases-covid-19	zoomToSelection=true&casesMetric=true&dailyFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true
4019	daily-new-confirmed-cases-of-covid-19	zoomToSelection=true&casesMetric=true&dailyFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true
4019	daily-cases-covid-19-who	zoomToSelection=true&casesMetric=true&dailyFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true
4020	total-deaths-covid-19	zoomToSelection=true&deathsMetric=true&totalFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true
4020	total-deaths-covid-19-who	zoomToSelection=true&deathsMetric=true&totalFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true
4021	daily-deaths-covid-19	zoomToSelection=true&deathsMetric=true&dailyFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true
4021	daily-new-confirmed-deaths-due-to-covid-19	zoomToSelection=true&deathsMetric=true&dailyFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true
4021	daily-deaths-covid-19-who	zoomToSelection=true&deathsMetric=true&dailyFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true
4025	covid-confirmed-cases-per-million-since-1-per-million	yScale=log&zoomToSelection=true&casesMetric=true&totalFreq=true&aligned=true&perCapita=true&smoothing=0&country=&hideControls=true
4037	covid-confirmed-deaths-since-5th-death	yScale=log&zoomToSelection=true&deathsMetric=true&totalFreq=true&aligned=true&smoothing=0&country=&hideControls=true
4037	covid-confirmed-deaths-since-10th-death	yScale=log&zoomToSelection=true&deathsMetric=true&totalFreq=true&aligned=true&smoothing=0&country=&hideControls=true
4039	covid-confirmed-cases-since-100th-case	yScale=log&zoomToSelection=true&casesMetric=true&totalFreq=true&aligned=true&smoothing=0&country=&hideControls=true
4039	covid-tests-since-100th-case	yScale=log&zoomToSelection=true&casesMetric=true&totalFreq=true&aligned=true&smoothing=0&country=&hideControls=true
4049	case-fatality-rate-covid-19	zoomToSelection=true&time=2020-03-14..&cfrMetric=true&totalFreq=true&aligned=true&smoothing=0&country=OWID_WRL~USA~ITA~BRA~ESP~SWE~DEU~IND~IRN&hideControls=true
4056	coronavirus-cfr	zoomToSelection=true&time=2020-03-14..&cfrMetric=true&totalFreq=true&aligned=true&smoothing=0&country=OWID_WRL~USA~ITA~BRA~ESP~SWE~DEU~IND~IRN&hideControls=true
4057	covid-deaths-days-since-per-million	yScale=log&zoomToSelection=true&minPopulationFilter=1000000&deathsMetric=true&totalFreq=true&aligned=true&perCapita=true&smoothing=0&country=&hideControls=true
4063	covid-confirmed-daily-cases-epidemiological-trajectory	yScale=log&zoomToSelection=true&minPopulationFilter=1000000&casesMetric=true&dailyFreq=true&aligned=true&smoothing=7&country=&hideControls=true
4063	covid-confirmed-daily-cases-since-100th-case	yScale=log&zoomToSelection=true&minPopulationFilter=1000000&casesMetric=true&dailyFreq=true&aligned=true&smoothing=7&country=&hideControls=true
4078	covid-confirmed-daily-deaths-epidemiological-trajectory	yScale=log&zoomToSelection=true&minPopulationFilter=1000000&deathsMetric=true&dailyFreq=true&aligned=true&smoothing=7&country=&hideControls=true
4101	covid-confirmed-cases-since-100th-case	yScale=log&zoomToSelection=true&casesMetric=true&totalFreq=true&aligned=true&smoothing=0&country=&hideControls=true
4106	covid-daily-deaths-trajectory-per-million	yScale=log&zoomToSelection=true&minPopulationFilter=1000000&deathsMetric=true&dailyFreq=true&aligned=true&perCapita=true&smoothing=7&country=&hideControls=true
4107	covid-daily-cases-trajectory-per-million	yScale=log&zoomToSelection=true&minPopulationFilter=1000000&casesMetric=true&dailyFreq=true&aligned=true&perCapita=true&smoothing=7&country=&hideControls=true
4129	total-tests-per-thousand-since-per-cap-death-threshold	yScale=log&zoomToSelection=true&testsMetric=true&totalFreq=true&aligned=true&perCapita=true&smoothing=0&country=&hideControls=true
4027	total-confirmed-cases-of-covid-19-per-million-people	tab=map&zoomToSelection=true&country=GBR~USA~ESP~ITA~BRA~IND~KOR&region=World&casesMetric=true&interval=total&perCapita=true&smoothing=0&pickerMetric=location&pickerSort=asc&hideControls=true
4028	new-covid-cases-per-million	tab=map&zoomToSelection=true&country=GBR~USA~ESP~ITA~BRA~IND~KOR&region=World&casesMetric=true&interval=daily&perCapita=true&smoothing=0&pickerMetric=location&pickerSort=asc&hideControls=true
4029	total-covid-deaths-per-million	tab=map&zoomToSelection=true&country=GBR~USA~ESP~ITA~BRA~IND~KOR&region=World&deathsMetric=true&interval=total&perCapita=true&smoothing=0&pickerMetric=location&pickerSort=asc&hideControls=true
4030	new-covid-deaths-per-million	tab=map&zoomToSelection=true&country=GBR~USA~ESP~ITA~BRA~IND~KOR&region=World&deathsMetric=true&interval=daily&perCapita=true&smoothing=0&pickerMetric=location&pickerSort=asc&hideControls=true
4110	daily-covid-deaths-per-million-7-day-average	zoomToSelection=true&minPopulationFilter=1000000&deathsMetric=true&dailyFreq=true&perCapita=true&smoothing=7&country=USA~GBR~ITA~DEU~KOR~ZAF~BRA&pickerMetric=location&pickerSort=asc&hideControls=true
4225	daily-new-confirmed-cases-of-covid-19-tests-per-case	yScale=log&zoomToSelection=true&time=2020-02-22..latest&country=&region=World&casesMetric=true&interval=smoothed&aligned=true&smoothing=7&pickerMetric=total_deaths&pickerSort=desc&hideControls=true
4236	daily-new-confirmed-cases-of-covid-19-per-million-tests-per-case	yScale=log&zoomToSelection=true&minPopulationFilter=1000000&time=2020-02-22..latest&country=&region=World&casesMetric=true&interval=smoothed&aligned=true&perCapita=true&smoothing=7&pickerMetric=total_deaths&pickerSort=desc&hideControls=true
4490	daily-covid-cases-7-day	zoomToSelection=true&time=2020-10-16..latest&country=USA~IND~GBR~DEU~BRA~MEX&region=World&casesMetric=true&interval=smoothed&smoothing=7&pickerMetric=total_cases&pickerSort=desc&hideControls=true
4490	daily-covid-cases-7-day-average	zoomToSelection=true&time=2020-10-16..latest&country=USA~IND~GBR~DEU~BRA~MEX&region=World&casesMetric=true&interval=smoothed&smoothing=7&pickerMetric=total_cases&pickerSort=desc&hideControls=true`

export const legacyGrapherToCovidExplorerRedirectTable = new CoreTable(
    redirectTableTsv
)

// In addition to the query strings above, the below ones are ones we need to redirect to the new Covid Explorer.
// It is about 80 different ones, but it may just be like a 10 liner map function that takes old params and converts
// Test case:
//
// https://ourworldindata.org/coronavirus-data-explorer?country=~FRA&cfrMetric=true
//
// should redirect to:
//
// https://staging.owid.cloud/admin/explorers/preview/coronavirus-data-explorer?patch=selection-is-France-and-Metric%20Radio-is-Case%20Fatality%20Rate
//
// Obviously the final details of the new link will change, but if we have tests and do strings as consts should be easy to finalize once we settle on the new URL details.

const queryStringsToRedirect = `casesMetric=true&interval=daily&aligned=true&perCapita=true&smoothing=0
casesMetric=true&interval=daily&perCapita=true&smoothing=0
casesMetric=true&interval=daily&aligned=true&smoothing=0
casesMetric=true&interval=daily&smoothing=0
casesMetric=true&interval=weekly&smoothing=7
casesMetric=true&interval=total&aligned=true&perCapita=true&smoothing=0
casesMetric=true&interval=total&perCapita=true&smoothing=0
casesMetric=true&interval=total&aligned=true&smoothing=0
casesMetric=true&interval=total&smoothing=0
casesMetric=true&interval=smoothed&aligned=true&perCapita=true&smoothing=7
casesMetric=true&interval=smoothed&perCapita=true&smoothing=7
casesMetric=true&interval=smoothed&aligned=true&smoothing=7
casesMetric=true&interval=smoothed&smoothing=7
casesMetric=true&interval=biweekly&smoothing=14
casesMetric=true&interval=weeklyChange&smoothing=7
casesMetric=true&interval=biweeklyChange&smoothing=14
deathsMetric=true&interval=daily&aligned=true&perCapita=true&smoothing=0
deathsMetric=true&interval=daily&perCapita=true&smoothing=0
deathsMetric=true&interval=daily&aligned=true&smoothing=0
deathsMetric=true&interval=daily&smoothing=0
deathsMetric=true&interval=weekly&smoothing=7
deathsMetric=true&interval=total&aligned=true&perCapita=true&smoothing=0
deathsMetric=true&interval=total&perCapita=true&smoothing=0
deathsMetric=true&interval=total&aligned=true&smoothing=0
deathsMetric=true&interval=total&smoothing=0
deathsMetric=true&interval=smoothed&aligned=true&perCapita=true&smoothing=7
deathsMetric=true&interval=smoothed&perCapita=true&smoothing=7
deathsMetric=true&interval=smoothed&aligned=true&smoothing=7
deathsMetric=true&interval=smoothed&smoothing=7
deathsMetric=true&interval=biweekly&smoothing=14
deathsMetric=true&interval=weeklyChange&smoothing=7
deathsMetric=true&interval=biweeklyChange&smoothing=14
cfrMetric=true&interval=total&smoothing=0
testsMetric=true&interval=daily&aligned=true&perCapita=true&smoothing=0
testsMetric=true&interval=daily&perCapita=true&smoothing=0
testsMetric=true&interval=daily&aligned=true&smoothing=0
testsMetric=true&interval=daily&smoothing=0
testsMetric=true&interval=total&aligned=true&perCapita=true&smoothing=0
testsMetric=true&interval=total&perCapita=true&smoothing=0
testsMetric=true&interval=total&aligned=true&smoothing=0
testsMetric=true&interval=total&smoothing=0
testsMetric=true&interval=smoothed&aligned=true&perCapita=true&smoothing=7
testsMetric=true&interval=smoothed&perCapita=true&smoothing=7
testsMetric=true&interval=smoothed&aligned=true&smoothing=7
testsMetric=true&interval=smoothed&smoothing=7
testsPerCaseMetric=true&interval=smoothed&smoothing=7
testsPerCaseMetric=true&interval=total&smoothing=0
positiveTestRate=true&interval=smoothed&smoothing=7
positiveTestRate=true&interval=total&smoothing=0`

let cached: ExplorerProgram
// todo: remove
export const getLegacyCovidExplorerAsExplorerProgramForSlug = async (
    slug: string
) => {
    const { row } = legacyGrapherToCovidExplorerRedirectTable.where({
        slug,
    }).firstRow
    if (!row) return undefined

    if (!cached)
        cached = await getExplorerFromFile(
            undefined,
            legacyCovidDashboardSlug + EXPLORER_FILE_SUFFIX
        )

    // todo: use querystring
    return cached
}

// todo: remove
export const hasLegacyGrapherToCovidExplorerRedirect = (grapherId: number) =>
    legacyGrapherToCovidExplorerRedirectTable
        .get("id")
        .uniqValuesAsSet.has(grapherId)

// todo: remove
export const replaceLegacyGrapherIframesWithExplorerRedirectsInWordPressPost = (
    cheerio: CheerioStatic
) =>
    cheerio("iframe")
        .toArray()
        .filter((el) => (el.attribs["src"] || "").match(/\/grapher\//))
        .forEach((el) => {
            const url = el.attribs["src"].trim()
            const slug = urlToSlug(url)

            const match = legacyGrapherToCovidExplorerRedirectTable.where({
                slug,
            }).firstRow

            if (!match) return

            const matchQueryStr = url.match(/\?([^#]*)/)
            const chartQueryStr = matchQueryStr ? matchQueryStr[1] : ""
            const queryStr = mergeQueryStr(
                match.explorerQueryStr,
                chartQueryStr
            )
            // Replace Grapher iframe src with explorer src
            el.attribs[
                "src"
            ] = `${BAKED_BASE_URL}/explorers/${legacyCovidDashboardSlug}${queryStr}`
        })
