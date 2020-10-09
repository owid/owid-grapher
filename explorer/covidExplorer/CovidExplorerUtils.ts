import {
    computeRollingAverage,
    dateDiffInDays,
    difference,
    fetchJSON,
    fetchText,
    flatten,
    groupBy,
    insertMissingValuePlaceholders,
    max,
    memoize,
    minBy,
    parseFloatOrUndefined,
    retryPromise,
    sortBy,
} from "grapher/utils/Util"
import moment from "moment"
import { csv } from "d3-fetch"
import { csvParse } from "d3-dsv"
import {
    covidChartAndVariableMetaPath,
    covidDataPath,
    CovidRow,
    covidLastUpdatedPath,
    MegaCovidRow,
    MetricOptions,
    sourceVariables,
} from "./CovidConstants"
import { ColumnTypeNames, CoreRow } from "coreTable/CoreTableConstants"
import { OwidColumnSpec } from "coreTable/OwidTableConstants"

const stringColumnSlugs = new Set(
    `iso_code location date tests_units continent`.split(" ")
)

const globalEntityIds = new Map()
const generateEntityId = (entityName: string) => {
    if (!globalEntityIds.has(entityName))
        globalEntityIds.set(entityName, globalEntityIds.size)
    return globalEntityIds.get(entityName)
}

const dateToYearCache = new Map<string, number>() // Cache for performance
const dateToYear = (dateString: string): number => {
    if (!dateToYearCache.has(dateString))
        dateToYearCache.set(
            dateString,
            dateDiffInDays(
                moment.utc(dateString).toDate(),
                moment.utc("2020-01-21").toDate()
            )
        )
    return dateToYearCache.get(dateString)!
}

const calculateCovidRowsForGroup = (
    group: MegaCovidRow[],
    groupName: string
) => {
    const rowsByDay = new Map<string, CovidRow>()
    const rows = sortBy(group, (row) => dateToYear(row.date))
    const groupMembers = new Set()
    rows.forEach((row) => {
        const day = row.date
        groupMembers.add(row.iso_code)
        if (!rowsByDay.has(day)) {
            const newRow: any = {}
            Object.keys(row).forEach((key) => (newRow[key] = undefined))
            rowsByDay.set(day, {
                location: groupName,
                continent: row.continent,
                iso_code: groupName.replace(" ", ""),
                date: day,
                day: dateToYear(day),
                new_cases: 0,
                entityName: groupName,
                entityCode: groupName.replace(" ", ""),
                entityId: generateEntityId(groupName),
                new_deaths: 0,
                population: 0,
            } as CovidRow)
        }
        const newRow = rowsByDay.get(day)!
        newRow.population += row.population
        newRow.new_cases += row.new_cases || 0
        newRow.new_deaths += row.new_deaths || 0
    })
    const newRows = Array.from(rowsByDay.values())
    let total_cases = 0
    let total_deaths = 0
    let maxPopulation = 0
    const group_members = Array.from(groupMembers).join("")
    // We need to compute cumulatives again because sometimes data will stop for a country.
    newRows.forEach((row) => {
        total_cases += row.new_cases
        total_deaths += row.new_deaths
        row.total_cases = total_cases
        row.total_deaths = total_deaths
        row.group_members = group_members
        if (row.population > maxPopulation) maxPopulation = row.population

        // Once we add a country to a group, we assume we will always have data for that country, so even if the
        // country is late in reporting the data keep that country in the population count.
        row.population = maxPopulation
    })
    return newRows
}

// Generates rows for each region.
export const generateCovidRowsForContinents = (rows: MegaCovidRow[]) => {
    const grouped = groupBy(rows, "continent")
    return flatten(
        Object.keys(grouped)
            .filter((cont) => cont)
            .map((continentName) =>
                calculateCovidRowsForGroup(
                    grouped[continentName],
                    continentName
                )
            )
    )
}

const fetchMegaCovidRows = async () => {
    const rows = await csv(covidDataPath)
    return (rows as any) as MegaCovidRow[]
}

const parseMegaCovidRow = (row: MegaCovidRow) => {
    const newRow: Partial<CovidRow> = row
    Object.keys(row).forEach((columnSlug) => {
        const isNumeric = !stringColumnSlugs.has(columnSlug)
        if (isNumeric)
            (row as any)[columnSlug] = parseFloatOrUndefined(
                (row as any)[columnSlug]
            )
    })

    if (row.location === "International") row.iso_code = "OWID_INT"

    newRow.entityName = row.location
    newRow.entityCode = row.iso_code
    newRow.day = dateToYear(row.date)
    newRow.time = newRow.day // todo: cleanup
    newRow.entityId = generateEntityId(row.location)

    if (newRow.location === "World") newRow.group_members = "All"

    return newRow as CovidRow
}

// Todo: move these ops to the table class.
const parseMegaCovidRows = (megaCovidRows: MegaCovidRow[]) => {
    const filtered: CovidRow[] = megaCovidRows
        .map(parseMegaCovidRow)
        .filter((row: CovidRow) => row.location !== "International")

    const latestDate = max(filtered.map((row) => row.date))

    const continentRows = generateCovidRowsForContinents(filtered).filter(
        // Drop the last day in aggregates containing Spain & Sweden
        (row) => !(row.date === latestDate && row.location === "Europe")
    )

    const euRows = calculateCovidRowsForGroup(
        filtered.filter((row: MegaCovidRow) => euCountries.has(row.location)),
        "European Union"
        // Drop the last day in aggregates containing Spain & Sweden
    ).filter((row) => row.date !== latestDate)

    return filtered.concat(continentRows, euRows)
}

export const fetchAndParseMegaCovidRows = async () => {
    // const megaRows = await fetchMegaCovidRows()
    // return parseMegaCovidRows(megaRows)
    return parseMegaCovidRows(covidSampleRows)
}

const euCountries = new Set([
    "Austria",
    "Belgium",
    "Bulgaria",
    "Croatia",
    "Cyprus",
    "Czech Republic",
    "Denmark",
    "Estonia",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Hungary",
    "Ireland",
    "Italy",
    "Latvia",
    "Lithuania",
    "Luxembourg",
    "Malta",
    "Netherlands",
    "Poland",
    "Portugal",
    "Romania",
    "Slovakia",
    "Slovenia",
    "Spain",
    "Sweden",
])

// Todo: replace with someone else's library
export const computeRollingAveragesForEachGroup = (
    rows: CoreRow[],
    valueAccessor: (row: CoreRow) => any,
    groupColName: string,
    dateColName: string,
    rollingAverage: number
) => {
    const groups: number[][] = []
    if (!rows[0]) return []
    let currentGroup = rows[0][groupColName]
    let currentRows: CoreRow[] = []
    // Assumes items are sorted by entity
    for (let i = 0; i <= rows.length; i++) {
        const row = rows[i]
        const groupName = row && row[groupColName]

        if (currentGroup !== groupName) {
            const averages = computeRollingAverage(
                insertMissingValuePlaceholders(
                    currentRows.map(valueAccessor),
                    currentRows.map((row) => row[dateColName])
                ),
                rollingAverage
            ).filter((value) => value !== null) as number[]
            groups.push(averages)
            if (!row) break
            currentRows = []
            currentGroup = groupName
        }
        currentRows.push(row)
    }
    return flatten(groups)
}

const memoizedFetchAndParseMegaCovidRows = memoize(fetchAndParseMegaCovidRows)

const fetchLastUpdatedTime = memoize(() =>
    retryPromise(() => fetchText(covidLastUpdatedPath))
)

// Fetchs the baked JSON file containing chart and variables meta data for maps and source tabs.
const fetchCovidChartAndVariableMeta = memoize(() =>
    retryPromise(() => fetchJSON(covidChartAndVariableMetaPath))
)

export const fetchRequiredData = async () => {
    const [covidRows, updated, covidMeta] = await Promise.all([
        memoizedFetchAndParseMegaCovidRows(),
        fetchLastUpdatedTime(),
        fetchCovidChartAndVariableMeta(),
    ])
    return {
        covidRows,
        updated,
        covidMeta,
    }
}

export const perCapitaDivisorByMetric = (metric: MetricOptions) =>
    metric === MetricOptions.tests ? 1e3 : 1e6

export function getLeastUsedColor(
    availableColors: string[],
    usedColors: string[]
): string {
    // If there are unused colors, return the first available
    const unusedColors = difference(availableColors, usedColors)
    if (unusedColors.length > 0) {
        return unusedColors[0]
    }
    // If all colors are used, we want to count the times each color is used, and use the most
    // unused one.
    const colorCounts = Object.entries(
        groupBy(usedColors)
    ).map(([color, arr]) => [color, arr.length])
    const mostUnusedColor = minBy(colorCounts, ([, count]) => count) as [
        string,
        number
    ]
    return mostUnusedColor[0]
}

const sampleMegaCsv = `population,iso_code,location,continent,date,total_cases,new_cases,total_deaths,new_deaths,total_cases_per_million,new_cases_per_million,total_deaths_per_million,new_deaths_per_million,total_tests,new_tests,total_tests_per_thousand,new_tests_per_thousand,tests_units
1000,ABW,Aruba,North America,2020-03-13,2,2,0,0,18.733,18.733,0.0,0.0,,,,,
1000,ABW,Aruba,North America,2020-03-20,4,2,0,0,37.465,18.733,0.0,0.0,,,,,
1000,ABW,Aruba,North America,2020-03-24,12,8,0,0,112.395,74.93,0.0,0.0,,,,,
1000,ABW,Aruba,North America,2020-03-25,17,5,0,0,159.227,46.831,0.0,0.0,,,,,
2000,USA,United States,North America,2020-05-05,1180634,22593,68934,1252,3566.842,68.256,208.258,3.782,7544328.0,258954.0,22.792,0.782,inconsistent units (COVID Tracking Project)
2000,USA,United States,North America,2020-05-06,1204475,23841,71078,2144,3638.868,72.027,214.735,6.477,,,,,
3000,,World,,2020-05-01,3215927,84440,232869,5534,412.573,10.833,29.875,0.71,,,,,
3000,,World,,2020-05-02,3308891,92964,238707,5838,424.5,11.926,30.624,0.749,,,,,
3000,,World,,2020-05-03,3389459,80568,243476,4769,434.836,10.336,31.236,0.612,,,,,
3000,,World,,2020-05-04,3467502,78043,246999,3523,444.848,10.012,31.688,0.452,,,,,
3000,,World,,2020-05-05,3544168,76666,250977,3978,454.684,9.836,32.198,0.51,,,,,
3000,,World,,2020-05-06,3623803,79635,256880,5903,464.9,10.216,32.955,0.757,,,,,`

const covidSampleMegaRows = (csvParse(sampleMegaCsv) as any) as MegaCovidRow[]
export const covidSampleRows = parseMegaCovidRows(covidSampleMegaRows)

// Ideally we would just have 1 set of column specs. Currently however we have some hard coded here, some coming from the Grapher backend, and some
// generated on the fly. These "template specs" are used to generate specs on the fly. Todo: cleanup.

export type CovidColumnSpecObjectMap = { [key: string]: OwidColumnSpec }

export const makeColumnSpecTemplates = (
    specsFromGrapherBackend: CovidColumnSpecObjectMap = {}
): CovidColumnSpecObjectMap => {
    const templates = {
        positive_test_rate: {
            ...specsFromGrapherBackend[sourceVariables.positive_test_rate],
            isDailyMeasurement: true,
            description:
                "The number of confirmed cases divided by the number of tests, expressed as a percentage. Tests may refer to the number of tests performed or the number of people tested – depending on which is reported by the particular country.",
        },
        tests_per_case: {
            ...specsFromGrapherBackend[sourceVariables.tests_per_case],
            isDailyMeasurement: true,
            description:
                "The number of tests divided by the number of confirmed cases. Not all countries report testing data on a daily basis.",
        },
        case_fatality_rate: {
            ...specsFromGrapherBackend[sourceVariables.case_fatality_rate],
            // annotationsColumnSlug: "case_fatality_rate_annotations", // todo: readd annotations as a propety like size or color
            isDailyMeasurement: true,
            description: `The Case Fatality Rate (CFR) is the ratio between confirmed deaths and confirmed cases. During an outbreak of a pandemic the CFR is a poor measure of the mortality risk of the disease. We explain this in detail at OurWorldInData.org/Coronavirus`,
        },
        cases: {
            ...specsFromGrapherBackend[sourceVariables.cases],
            isDailyMeasurement: true,
            // annotationsColumnSlug: "cases_annotations",
            name: "Confirmed cases of COVID-19",
            description: `The number of confirmed cases is lower than the number of actual cases; the main reason for that is limited testing.`,
        },
        deaths: {
            ...specsFromGrapherBackend[sourceVariables.deaths],
            isDailyMeasurement: true,
            // annotationsColumnSlug: "deaths_annotations",
            name: "Confirmed deaths due to COVID-19",
            description: `Limited testing and challenges in the attribution of the cause of death means that the number of confirmed deaths may not be an accurate count of the true number of deaths from COVID-19.`,
        },
        tests: {
            ...specsFromGrapherBackend[sourceVariables.tests],
            isDailyMeasurement: true,
            description: "",
            name: "tests",
            // annotationsColumnSlug: "tests_units",
        },
        days_since: {
            ...specsFromGrapherBackend[sourceVariables.days_since],
            isDailyMeasurement: true,
            description: "",
            name: "days_since",
        },
        continents: {
            ...specsFromGrapherBackend[sourceVariables.continents],
            description: "",
            name: "continent",
            slug: "continent",
            type: ColumnTypeNames.Categorical,
        },
    }

    // Todo: move to the grapher specs?
    const ptrDisplay = templates.positive_test_rate.display
    if (ptrDisplay)
        ptrDisplay.tableDisplay = {
            hideRelativeChange: true,
        }

    const cfrDisplay = templates.case_fatality_rate.display
    if (cfrDisplay)
        cfrDisplay.tableDisplay = {
            hideRelativeChange: true,
        }

    return templates
}
