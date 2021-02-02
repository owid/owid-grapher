import { CoreTable } from "../coreTable/CoreTable"
import { ExplorerUrlMigrationId } from "../explorer/urlMigrations/ExplorerUrlMigrations"

const explorerRedirectTableMatrix = [
    ["migrationId", "path", "baseQueryStr"],
    [
        "legacyToGridCovidExplorer",
        "/grapher/total-cases-covid-19",
        "zoomToSelection=true&casesMetric=true&totalFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/total-confirmed-cases-of-covid-19",
        "zoomToSelection=true&casesMetric=true&totalFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/total-cases-covid-19-who",
        "zoomToSelection=true&casesMetric=true&totalFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/daily-cases-covid-19",
        "zoomToSelection=true&casesMetric=true&dailyFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/daily-new-confirmed-cases-of-covid-19",
        "zoomToSelection=true&casesMetric=true&dailyFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/daily-cases-covid-19-who",
        "zoomToSelection=true&casesMetric=true&dailyFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/total-deaths-covid-19",
        "zoomToSelection=true&deathsMetric=true&totalFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/total-deaths-covid-19-who",
        "zoomToSelection=true&deathsMetric=true&totalFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/daily-deaths-covid-19",
        "zoomToSelection=true&deathsMetric=true&dailyFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/daily-new-confirmed-deaths-due-to-covid-19",
        "zoomToSelection=true&deathsMetric=true&dailyFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/daily-deaths-covid-19-who",
        "zoomToSelection=true&deathsMetric=true&dailyFreq=true&smoothing=0&country=~OWID_WRL&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/covid-confirmed-cases-per-million-since-1-per-million",
        "yScale=log&zoomToSelection=true&casesMetric=true&totalFreq=true&aligned=true&perCapita=true&smoothing=0&country=&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/covid-confirmed-deaths-since-5th-death",
        "yScale=log&zoomToSelection=true&deathsMetric=true&totalFreq=true&aligned=true&smoothing=0&country=&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/covid-confirmed-deaths-since-10th-death",
        "yScale=log&zoomToSelection=true&deathsMetric=true&totalFreq=true&aligned=true&smoothing=0&country=&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/covid-confirmed-cases-since-100th-case",
        "yScale=log&zoomToSelection=true&casesMetric=true&totalFreq=true&aligned=true&smoothing=0&country=&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/covid-tests-since-100th-case",
        "yScale=log&zoomToSelection=true&casesMetric=true&totalFreq=true&aligned=true&smoothing=0&country=&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/case-fatality-rate-covid-19",
        "zoomToSelection=true&time=2020-03-14..&cfrMetric=true&totalFreq=true&aligned=true&smoothing=0&country=OWID_WRL~USA~ITA~BRA~ESP~SWE~DEU~IND~IRN&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/coronavirus-cfr",
        "zoomToSelection=true&time=2020-03-14..&cfrMetric=true&totalFreq=true&aligned=true&smoothing=0&country=OWID_WRL~USA~ITA~BRA~ESP~SWE~DEU~IND~IRN&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/covid-deaths-days-since-per-million",
        "yScale=log&zoomToSelection=true&minPopulationFilter=1000000&deathsMetric=true&totalFreq=true&aligned=true&perCapita=true&smoothing=0&country=&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/covid-confirmed-daily-cases-epidemiological-trajectory",
        "yScale=log&zoomToSelection=true&minPopulationFilter=1000000&casesMetric=true&dailyFreq=true&aligned=true&smoothing=7&country=&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/covid-confirmed-daily-cases-since-100th-case",
        "yScale=log&zoomToSelection=true&minPopulationFilter=1000000&casesMetric=true&dailyFreq=true&aligned=true&smoothing=7&country=&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/covid-confirmed-daily-deaths-epidemiological-trajectory",
        "yScale=log&zoomToSelection=true&minPopulationFilter=1000000&deathsMetric=true&dailyFreq=true&aligned=true&smoothing=7&country=&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/covid-confirmed-cases-since-100th-case",
        "yScale=log&zoomToSelection=true&casesMetric=true&totalFreq=true&aligned=true&smoothing=0&country=&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/covid-daily-deaths-trajectory-per-million",
        "yScale=log&zoomToSelection=true&minPopulationFilter=1000000&deathsMetric=true&dailyFreq=true&aligned=true&perCapita=true&smoothing=7&country=&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/covid-daily-cases-trajectory-per-million",
        "yScale=log&zoomToSelection=true&minPopulationFilter=1000000&casesMetric=true&dailyFreq=true&aligned=true&perCapita=true&smoothing=7&country=&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/total-tests-per-thousand-since-per-cap-death-threshold",
        "yScale=log&zoomToSelection=true&testsMetric=true&totalFreq=true&aligned=true&perCapita=true&smoothing=0&country=&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/total-confirmed-cases-of-covid-19-per-million-people",
        "tab=map&zoomToSelection=true&country=GBR~USA~ESP~ITA~BRA~IND~KOR&region=World&casesMetric=true&interval=total&perCapita=true&smoothing=0&pickerMetric=location&pickerSort=asc&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/new-covid-cases-per-million",
        "tab=map&zoomToSelection=true&country=GBR~USA~ESP~ITA~BRA~IND~KOR&region=World&casesMetric=true&interval=daily&perCapita=true&smoothing=0&pickerMetric=location&pickerSort=asc&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/total-covid-deaths-per-million",
        "tab=map&zoomToSelection=true&country=GBR~USA~ESP~ITA~BRA~IND~KOR&region=World&deathsMetric=true&interval=total&perCapita=true&smoothing=0&pickerMetric=location&pickerSort=asc&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/new-covid-deaths-per-million",
        "tab=map&zoomToSelection=true&country=GBR~USA~ESP~ITA~BRA~IND~KOR&region=World&deathsMetric=true&interval=daily&perCapita=true&smoothing=0&pickerMetric=location&pickerSort=asc&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/daily-covid-deaths-per-million-7-day-average",
        "zoomToSelection=true&minPopulationFilter=1000000&deathsMetric=true&dailyFreq=true&perCapita=true&smoothing=7&country=USA~GBR~ITA~DEU~KOR~ZAF~BRA&pickerMetric=location&pickerSort=asc&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/daily-new-confirmed-cases-of-covid-19-tests-per-case",
        "yScale=log&zoomToSelection=true&time=2020-02-22..latest&country=&region=World&casesMetric=true&interval=smoothed&aligned=true&smoothing=7&pickerMetric=total_deaths&pickerSort=desc&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/daily-new-confirmed-cases-of-covid-19-per-million-tests-per-case",
        "yScale=log&zoomToSelection=true&minPopulationFilter=1000000&time=2020-02-22..latest&country=&region=World&casesMetric=true&interval=smoothed&aligned=true&perCapita=true&smoothing=7&pickerMetric=total_deaths&pickerSort=desc&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/daily-covid-cases-7-day",
        "zoomToSelection=true&time=2020-10-16..latest&country=USA~IND~GBR~DEU~BRA~MEX&region=World&casesMetric=true&interval=smoothed&smoothing=7&pickerMetric=total_cases&pickerSort=desc&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/daily-covid-cases-7-day-average",
        "zoomToSelection=true&time=2020-10-16..latest&country=USA~IND~GBR~DEU~BRA~MEX&region=World&casesMetric=true&interval=smoothed&smoothing=7&pickerMetric=total_cases&pickerSort=desc&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/daily-covid-cases-3-day-average",
        "zoomToSelection=true&time=2020-10-16..latest&country=USA~IND~GBR~DEU~BRA~MEX&region=World&casesMetric=true&interval=smoothed&smoothing=7&pickerMetric=total_cases&pickerSort=desc&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/daily-covid-cases-per-million-three-day-avg",
        "zoomToSelection=true&time=2020-03-01..latest&country=MEX~IND~USA~ITA~BRA~GBR~FRA~ESP&casesMetric=true&interval=smoothed&perCapita=true&smoothing=7&pickerMetric=total_deaths&pickerSort=desc&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/grapher/daily-covid-deaths-per-million-3-day-avg",
        "zoomToSelection=true&time=2020-03-01..latest&country=MEX~IND~USA~ITA~BRA~GBR~FRA~ESP&deathsMetric=true&interval=smoothed&perCapita=true&smoothing=7&pickerMetric=total_deaths&pickerSort=desc&hideControls=true",
    ],
    [
        "legacyToGridCovidExplorer",
        "/coronavirus-data-explorer",
        "zoomToSelection=true&time=2020-03-01..latest&country=IND~USA~GBR~CAN~DEU~FRA&region=World&casesMetric=true&interval=smoothed&perCapita=true&smoothing=7&pickerMetric=total_cases&pickerSort=desc",
    ],
]

interface RedirectRow {
    migrationId: ExplorerUrlMigrationId
    path: string
    baseQueryStr: string
}

export const explorerRedirectTable = new CoreTable<RedirectRow>(
    explorerRedirectTableMatrix
)

const standardizePath = (path: string): string =>
    !path.startsWith("/") ? `/${path}` : path

export const getExplorerRedirectForPath = (
    path: string
): RedirectRow | undefined => {
    path = standardizePath(path)
    return explorerRedirectTable.rows.find((redirect) => redirect.path === path)
}

export const isPathRedirectedToExplorer = (path: string) =>
    explorerRedirectTable.get("path").uniqValuesAsSet.has(standardizePath(path))
