import {
    dateDiffInDays,
    flatten,
    map,
    groupBy,
    parseFloatOrUndefined,
    difference,
    entries,
    minBy,
    sortBy,
    cloneDeep,
    retryPromise,
    memoize,
    fetchText
} from "charts/Util"
import moment from "moment"
import {
    ParsedCovidCsvRow,
    MetricKind,
    CountryOption,
    CovidGrapherRow,
    SmoothingOption
} from "./CovidTypes"
import { columnSpecs, trajectoryOptions } from "./CovidColumnSpecs"
import { csv } from "d3-fetch"
import { csvParse } from "d3-dsv"
import {
    OwidTable,
    ComputedColumnSpec,
    RowToValueMapper,
    ColumnSpec,
    entityName
} from "charts/owidData/OwidTable"
import { CovidConstrainedQueryParams, CovidQueryParams } from "./CovidChartUrl"
import { covidAnnotations } from "./CovidAnnotations"

type MetricKey = {
    [K in MetricKind]: number
}

interface AnnotationsRow {
    location: entityName
    date: string
    cases_annotations: string
    deaths_annotations: string
}

export class CovidExplorerTable {
    table: OwidTable
    lastUpdated: string
    constructor(
        table: OwidTable,
        data: CovidGrapherRow[],
        lastUpdated: string = ""
    ) {
        this.table = table
        this.table.addRowsAndDetectColumns(data)
        this.table.addColumnSpec(columnSpecs.continents)
        this.addAnnotationColumns()
        this.lastUpdated = lastUpdated
    }

    private addAnnotationColumns() {
        const caseSlug = "cases_annotations"
        const deathSlug = "deaths_annotations"
        const cfrSlug = "case_fatality_rate_annotations"
        this.table.addColumnSpec({ slug: caseSlug })
        this.table.addColumnSpec({
            slug: deathSlug
        })
        this.table.addColumnSpec({
            slug: cfrSlug
        })

        const index = this.table.entityIndex
        const annotationRows = csvParse(covidAnnotations) as AnnotationsRow[]
        annotationRows.forEach(annoRow => {
            const rows = index.get(annoRow.location)
            if (!rows) return
            // If no date on annotation apply to all rows
            const applyTo = annoRow.date
                ? rows.filter(row => row.date === annoRow.date)
                : rows
            const datePrefix = annoRow.date
                ? moment(annoRow.date).format("MMM D") + ": "
                : ""
            applyTo.forEach(row => {
                if (annoRow[caseSlug])
                    row[caseSlug] = datePrefix + annoRow[caseSlug]
                if (annoRow[deathSlug])
                    row[deathSlug] = datePrefix + annoRow[deathSlug]
                row[cfrSlug] = `${datePrefix}${annoRow[caseSlug] || ""}${
                    annoRow[deathSlug]
                }`
            })
        })
    }

    static async fetchAndParseData(): Promise<CovidGrapherRow[]> {
        const rawData = (await csv(covidDataPath)) as any
        const filtered = rawData
            .map(CovidExplorerTable.parseCovidRow)
            .filter((row: CovidGrapherRow) => row.location !== "International")

        const continentRows = CovidExplorerTable.generateContinentRows(filtered)

        const euRows = CovidExplorerTable.calculateRowsForGroup(
            filtered.filter((row: ParsedCovidCsvRow) =>
                CovidExplorerTable.euCountries.has(row.location)
            ),
            "European Union"
        )
        return filtered.concat(continentRows, euRows)
    }

    private static buildCovidVariableId(
        name: MetricKind,
        perCapita: number,
        rollingAverage?: number,
        daily?: boolean
    ): number {
        const arbitraryStartingPrefix = 1145
        const names: MetricKey = {
            tests: 0,
            cases: 1,
            deaths: 2,
            positive_test_rate: 3,
            case_fatality_rate: 4,
            tests_per_case: 5
        }
        const parts = [
            arbitraryStartingPrefix,
            names[name],
            daily ? 1 : 0,
            perCapita,
            rollingAverage
        ]
        return parseInt(parts.join(""))
    }

    buildColumnSpecFromParams(params: CovidConstrainedQueryParams) {
        return this.buildColumnSpec(
            this.getMetricName(params),
            this.perCapitaDivisor(params),
            params.dailyFreq,
            params.smoothing
        )
    }

    perCapitaDivisor(params: CovidConstrainedQueryParams) {
        return params.perCapita ? (params.testsMetric ? 1e3 : 1e6) : 1
    }

    private getColumnSlug(
        name: MetricKind,
        perCapita: number,
        daily?: boolean,
        rollingAverage?: number
    ) {
        return [
            name,
            perCapita === 1e3
                ? "perThousand"
                : perCapita === 1e6
                ? "perMil"
                : undefined,
            daily ? "daily" : "cumulative",
            rollingAverage ? rollingAverage + "DayAvg" : undefined
        ]
            .filter(i => i)
            .join("-")
    }

    buildColumnSpec(
        name: MetricKind,
        perCapita: number,
        daily?: boolean,
        rollingAverage?: number,
        updatedTime?: string
    ): ColumnSpec {
        const spec = cloneDeep(columnSpecs[name]) as ColumnSpec
        spec.slug = this.getColumnSlug(name, perCapita, daily, rollingAverage)
        spec.owidVariableId = CovidExplorerTable.buildCovidVariableId(
            name,
            perCapita,
            rollingAverage,
            daily
        )
        spec.source!.name = `${spec.source!.name}${updatedTime}`

        const messages: { [index: number]: string } = {
            1: "",
            1e3: " per thousand people",
            1e6: " per million people"
        }

        spec.display!.name = `${daily ? "Daily " : "Cumulative "}${
            spec.display!.name
        }${messages[perCapita]}`

        // Show decimal places for rolling average & per capita variables
        if (perCapita > 1) {
            spec.display!.numDecimalPlaces = 2
        } else if (
            name === "positive_test_rate" ||
            name === "case_fatality_rate" ||
            (rollingAverage && rollingAverage > 1)
        ) {
            spec.display!.numDecimalPlaces = 1
        } else {
            spec.display!.numDecimalPlaces = 0
        }

        return spec
    }

    private initColumn(
        params: CovidConstrainedQueryParams,
        rowFn: RowToValueMapper
    ) {
        const columnName = this.getMetricName(params)
        const perCapita = this.perCapitaDivisor(params)
        const smoothing = params.smoothing
        const spec = this.buildColumnSpec(
            columnName,
            perCapita,
            params.dailyFreq,
            smoothing,
            columnName === "tests" ? "" : " - " + this.lastUpdated
        )

        const table = this.table
        if (table.columnsBySlug.has(spec.slug)) return spec

        // The 7 day test smoothing is already calculated, so for now just reuse that instead of recalculating.
        const alreadySmoothed =
            (columnName === "tests" ||
                columnName === "tests_per_case" ||
                columnName === "positive_test_rate") &&
            smoothing === 7

        // todo: have perCapita column derived from regular column.
        if (perCapita > 1) {
            const originalRowFn = rowFn
            rowFn = row => {
                const value = originalRowFn(row)
                if (value === undefined) return undefined
                const pop = row.population
                if (!pop) {
                    console.log(
                        `Warning: Missing population for ${row.location}. Excluding from perCapita`
                    )
                    return undefined
                }
                return perCapita * (value / pop)
            }
        }

        if (smoothing && !alreadySmoothed)
            table.addRollingAverageColumn(
                spec,
                smoothing,
                rowFn,
                "day",
                "entityName"
            )
        else table.addComputedColumn({ ...spec, fn: rowFn })
        return spec
    }

    getMetricName(params: CovidConstrainedQueryParams): MetricKind {
        if (params.testsMetric) return "tests"
        if (params.casesMetric) return "cases"
        if (params.deathsMetric) return "deaths"
        if (params.cfrMetric) return "case_fatality_rate"
        if (params.testsPerCaseMetric) return "tests_per_case"
        return "positive_test_rate"
    }

    initTestingColumn(params: CovidConstrainedQueryParams) {
        if (params.dailyFreq)
            this.initColumn(params, row => {
                return params.smoothing === 7
                    ? row.new_tests_smoothed
                    : row.new_tests
            })
        else if (params.totalFreq)
            this.initColumn(params, row => row.total_tests)
    }

    initTestsPerCaseColumn(params: CovidConstrainedQueryParams) {
        if (params.dailyFreq && params.smoothing) {
            const casesSlug = this.addNewCasesSmoothedColumn(params.smoothing)
            this.initColumn(params, row => {
                if (
                    row.new_tests_smoothed === undefined ||
                    !(row as any)[casesSlug]
                )
                    return undefined

                if (row.entityName === "Peru" || row.entityName === "Ecuador")
                    return undefined

                const tpc = row.new_tests_smoothed / (row as any)[casesSlug]
                return tpc >= 1 ? tpc : undefined
            })
        } else if (params.totalFreq)
            this.initColumn(params, row => {
                if (row.total_tests === undefined || !row.total_cases)
                    return undefined

                if (row.entityName === "Peru" || row.entityName === "Ecuador")
                    return undefined

                const tpc = row.total_tests / row.total_cases
                return tpc >= 1 ? tpc : undefined
            })
    }

    initCfrColumn(params: CovidConstrainedQueryParams) {
        // We do not support daily freq for CFR
        if (params.totalFreq)
            this.initColumn(params, row =>
                row.total_cases < 100
                    ? undefined
                    : row.total_deaths && row.total_cases
                    ? (100 * row.total_deaths) / row.total_cases
                    : 0
            )
    }

    initCasesColumn(params: CovidConstrainedQueryParams) {
        this.initColumn(
            params,
            params.dailyFreq ? row => row.new_cases : row => row.total_cases
        )
    }

    getShortTermPositivityRateVarId() {
        // We init this column for the epi line colors on ScatterPlots
        const params = new CovidQueryParams("")
        params.smoothing = 7
        params.casesMetric = false
        params.perCapita = false
        params.dailyFreq = true
        params.positiveTestRate = true
        const spec = this.initTestRateColumn(params.constrainedParams)
        return spec.owidVariableId
    }

    initTestRateColumn(params: CovidConstrainedQueryParams) {
        if (params.dailyFreq) {
            const casesSlug = this.addNewCasesSmoothedColumn(params.smoothing)
            return this.initColumn(params, row => {
                const testCount =
                    params.smoothing === 7
                        ? row.new_tests_smoothed
                        : row.new_tests

                const cases =
                    params.smoothing === 7
                        ? (row as any)[casesSlug]
                        : row.new_cases

                if (row.entityName === "Peru" || row.entityName === "Ecuador")
                    return undefined

                if (!testCount) return undefined

                const rate = cases / testCount
                return rate >= 0 && rate <= 1 ? rate : undefined
            })
        }
        return this.initColumn(params, row => {
            if (row.total_cases === undefined || !row.total_tests)
                return undefined

            if (row.entityName === "Peru" || row.entityName === "Ecuador")
                return undefined

            const rate = row.total_cases / row.total_tests
            return rate >= 0 && rate <= 1 ? rate : undefined
        })
    }

    initDeathsColumn(params: CovidConstrainedQueryParams) {
        this.initColumn(
            params,
            params.dailyFreq ? row => row.new_deaths : row => row.total_deaths
        )
    }

    private groupFilterSlug = "group_filter"
    addGroupFilterColumn() {
        if (!this.table.columnsBySlug.has(this.groupFilterSlug))
            this.table.addFilterColumn(
                this.groupFilterSlug,
                row => !row.group_members
            )
    }

    removeGroupFilterColumn() {
        this.table.deleteColumnBySlug(this.groupFilterSlug)
    }

    initRequestedColumns(params: CovidConstrainedQueryParams) {
        if (params.casesMetric) this.initCasesColumn(params)
        if (params.deathsMetric) this.initDeathsColumn(params)
        if (params.testsMetric) this.initTestingColumn(params)
        if (params.testsPerCaseMetric) this.initTestsPerCaseColumn(params)
        if (params.cfrMetric) this.initCfrColumn(params)
        if (params.positiveTestRate) this.initTestRateColumn(params)

        if (params.aligned) {
            // If we are an aligned chart showing tests, we need to make a start of
            // pandemic column from deaths rate
            if (params.testsMetric) {
                const newParams: CovidConstrainedQueryParams = {
                    ...params
                } as CovidConstrainedQueryParams
                newParams.testsMetric = false
                newParams.deathsMetric = true
                this.initDeathsColumn(newParams)
            }

            const option = this.getTrajectoryOptions(params)
            this.addDaysSinceColumn(
                option.sourceSlug,
                option.id,
                option.threshold,
                option.title
            )
        }
    }

    addDaysSinceColumn(
        sourceColumnSlug: string,
        id: number,
        threshold: number,
        title: string
    ) {
        const table = this.table
        const slug = `daysSince${sourceColumnSlug}Hit${threshold}`
        const spec: ComputedColumnSpec = {
            ...columnSpecs.days_since,
            name: title,
            owidVariableId: id,
            slug,
            fn: row => {
                if (row.entityName !== currentCountry) {
                    const sourceValue = row[sourceColumnSlug]
                    if (sourceValue === undefined || sourceValue < threshold)
                        return undefined
                    currentCountry = row.entityName
                    countryExceededThresholdOnDay = row.day
                }
                return row.day - countryExceededThresholdOnDay
            }
        }

        let currentCountry: number
        let countryExceededThresholdOnDay: number
        table.addComputedColumn(spec)
        return slug
    }

    getTrajectoryOptions(params: CovidConstrainedQueryParams) {
        const key = params.casesMetric ? "cases" : "deaths"
        const daily = params.dailyFreq
        const perCapita = params.perCapita
        const smoothing = params.smoothing
        const option = {
            ...trajectoryOptions[key][
                perCapita ? "perCapita" : daily ? "daily" : "total"
            ],
            sourceSlug: this.getColumnSlug(
                key,
                perCapita ? 1e6 : 1,
                daily,
                smoothing
            )
        }
        return option
    }

    private addNewCasesSmoothedColumn(smoothing: SmoothingOption) {
        const slug = `new_cases_smoothed_${smoothing}day`
        if (this.table.columnsBySlug.has(slug)) return slug
        this.table.addRollingAverageColumn(
            {
                slug
            },
            smoothing,
            row => row.new_cases,
            "day",
            "entityName"
        )

        return slug
    }

    // Generates rows for each region.
    static generateContinentRows(rows: ParsedCovidCsvRow[]) {
        const grouped = groupBy(rows, "continent")
        return flatten(
            Object.keys(grouped)
                .filter(cont => cont)
                .map(continentName =>
                    this.calculateRowsForGroup(
                        grouped[continentName],
                        continentName
                    )
                )
        )
    }

    private static globalEntityIds = new Map()
    private static getEntityGuid(entityName: string) {
        if (!this.globalEntityIds.has(entityName))
            this.globalEntityIds.set(entityName, this.globalEntityIds.size)
        return this.globalEntityIds.get(entityName)
    }

    private static calculateRowsForGroup = (
        group: ParsedCovidCsvRow[],
        groupName: string
    ) => {
        const rowsByDay = new Map<string, CovidGrapherRow>()
        const rows = sortBy(group, row => moment(row.date).unix())
        const groupMembers = new Set()
        rows.forEach(row => {
            const day = row.date
            groupMembers.add(row.iso_code)
            if (!rowsByDay.has(day)) {
                const newRow: any = {}
                Object.keys(row).forEach(key => (newRow[key] = undefined))
                rowsByDay.set(day, {
                    location: groupName,
                    continent: row.continent,
                    iso_code: groupName.replace(" ", ""),
                    date: day,
                    day: dateToYear(day),
                    new_cases: 0,
                    entityName: groupName,
                    entityCode: groupName.replace(" ", ""),
                    entityId: CovidExplorerTable.getEntityGuid(groupName),
                    new_deaths: 0,
                    population: 0
                } as CovidGrapherRow)
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
        newRows.forEach(row => {
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

    private static euCountries = new Set([
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
        "Sweden"
    ])

    private static keepStrings = new Set(
        `iso_code location date tests_units continent`.split(" ")
    )

    static parseCovidRow(row: ParsedCovidCsvRow): CovidGrapherRow {
        const newRow: Partial<CovidGrapherRow> = row
        Object.keys(row).forEach(key => {
            const isNumeric = !CovidExplorerTable.keepStrings.has(key)
            if (isNumeric)
                (row as any)[key] = parseFloatOrUndefined((row as any)[key])
        })

        if (row.location === "International") row.iso_code = "OWID_INT"

        newRow.entityName = row.location
        newRow.entityCode = row.iso_code
        newRow.day = dateToYear(row.date)
        newRow.entityId = CovidExplorerTable.getEntityGuid(row.location)

        if (newRow.location === "World") newRow.group_members = "All"

        return row as CovidGrapherRow
    }

    static makeCountryOptions(data: ParsedCovidCsvRow[]): CountryOption[] {
        const rowsByCountry = groupBy(data, "iso_code")
        return map(rowsByCountry, rows => {
            const { location, iso_code, population, continent } = rows[0]
            return {
                name: location,
                slug: location,
                code: iso_code,
                population,
                continent,
                entityId: CovidExplorerTable.getEntityGuid(location),
                rows
            }
        })
    }
}

export const fetchAndParseData = memoize(CovidExplorerTable.fetchAndParseData)

const dateToYear = (dateString: string): number =>
    dateDiffInDays(
        moment.utc(dateString).toDate(),
        moment.utc("2020-01-21").toDate()
    )

export const covidDataPath =
    "https://covid.ourworldindata.org/data/owid-covid-data.csv"

export const covidLastUpdatedPath =
    "https://covid.ourworldindata.org/data/owid-covid-data-last-updated-timestamp.txt"

export const fetchLastUpdatedTime = memoize(() =>
    retryPromise(() => fetchText(covidLastUpdatedPath))
)

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
    const colorCounts = entries(groupBy(usedColors)).map(([color, arr]) => [
        color,
        arr.length
    ])
    const mostUnusedColor = minBy(colorCounts, ([, count]) => count) as [
        string,
        number
    ]
    return mostUnusedColor[0]
}
