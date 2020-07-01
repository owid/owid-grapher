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
    cloneDeep
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
import {
    OwidTable,
    ComputedColumnSpec,
    RowToValueMapper,
    ColumnSpec
} from "charts/owidData/OwidTable"
import { CovidConstrainedQueryParams } from "./CovidChartUrl"

type MetricKey = {
    [K in MetricKind]: number
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
        this.lastUpdated = lastUpdated
    }

    buildCovidVariableId(
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
        spec.owidVariableId = this.buildCovidVariableId(
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

    initColumn(
        params: CovidConstrainedQueryParams,
        rowFn: RowToValueMapper,
        daily: boolean = false,
        metricName?: MetricKind
    ) {
        const columnName = metricName || this.getMetricName(params)
        const perCapita = this.perCapitaDivisor(params)
        const smoothing = params.smoothing
        const spec = this.buildColumnSpec(
            columnName,
            perCapita,
            daily,
            smoothing,
            columnName === "tests" ? "" : " - " + this.lastUpdated
        )

        const table = this.table
        if (table.columnsBySlug.has(spec.slug)) return

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
            this.initColumn(
                params,
                row => {
                    return params.smoothing === 7
                        ? row.new_tests_smoothed
                        : row.new_tests
                },
                true
            )
        else if (params.totalFreq)
            this.initColumn(params, row => row.total_tests)
    }

    initTestsPerCaseColumn(params: CovidConstrainedQueryParams) {
        if (params.dailyFreq) {
            if (params.smoothing) {
                const casesSlug = this.addNewCasesSmoothedColumn(
                    params.smoothing
                )
                this.initColumn(
                    params,
                    row => {
                        if (
                            row.new_tests_smoothed === undefined ||
                            !(row as any)[casesSlug]
                        )
                            return undefined
                        const tpc =
                            row.new_tests_smoothed / (row as any)[casesSlug]
                        return tpc >= 1 ? tpc : undefined
                    },
                    true
                )
            } else {
                this.initColumn(
                    params,
                    row => {
                        if (row.new_tests === undefined || row.new_cases)
                            return undefined
                        const tpc = row.new_tests / row.new_cases
                        return tpc >= 1 ? tpc : undefined
                    },
                    true
                )
            }
        } else if (params.totalFreq)
            this.initColumn(params, row => {
                if (row.total_tests === undefined || !row.total_cases)
                    return undefined
                const tpc = row.total_tests / row.total_cases
                return tpc >= 1 ? tpc : undefined
            })
    }

    initCfrColumn(params: CovidConstrainedQueryParams) {
        if (params.dailyFreq)
            this.initColumn(
                params,
                row =>
                    row.total_cases < 100
                        ? undefined
                        : row.new_cases && row.new_deaths
                        ? (100 * row.new_deaths) / row.new_cases
                        : 0,
                true
            )
        else if (params.totalFreq)
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
            params.dailyFreq ? row => row.new_cases : row => row.total_cases,
            params.dailyFreq
        )
    }

    initTestRateColumn(params: CovidConstrainedQueryParams) {
        if (params.dailyFreq) {
            const casesSlug = this.addNewCasesSmoothedColumn(params.smoothing)
            this.initColumn(
                params,
                row => {
                    const testCount =
                        params.smoothing === 7
                            ? row.new_tests_smoothed
                            : row.new_tests

                    const cases =
                        params.smoothing === 7
                            ? (row as any)[casesSlug]
                            : row.new_cases

                    if (!testCount) return undefined

                    const rate = cases / testCount
                    return rate >= 0 && rate <= 1 ? rate : undefined
                },
                true
            )
        }
        if (params.totalFreq)
            this.initColumn(params, row => {
                if (row.total_cases === undefined || !row.total_tests)
                    return undefined
                const rate = row.total_cases / row.total_tests
                return rate >= 0 && rate <= 1 ? rate : undefined
            })
    }

    initDeathsColumn(params: CovidConstrainedQueryParams) {
        this.initColumn(
            params,
            params.dailyFreq ? row => row.new_deaths : row => row.total_deaths,
            params.dailyFreq
        )
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

    static async fetchAndParseData(): Promise<CovidGrapherRow[]> {
        const rawData = (await csv(covidDataPath)) as any
        const filtered = rawData
            .map(this.parseCovidRow)
            .filter((row: CovidGrapherRow) => row.location !== "International")

        const continentRows = this.generateContinentRows(filtered)

        const euRows = this.calculateRowsForGroup(
            filtered.filter((row: ParsedCovidCsvRow) =>
                this.euCountries.has(row.location)
            ),
            "European Union"
        )
        return filtered.concat(continentRows, euRows)
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
        rows.forEach(row => {
            const day = row.date
            if (!rowsByDay.has(day)) {
                const newRow: any = {}
                Object.keys(row).forEach(key => (newRow[key] = undefined))
                rowsByDay.set(day, {
                    location: groupName,
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
        // We need to compute cumulatives again because sometimes data will stop for a country.
        newRows.forEach(row => {
            total_cases += row.new_cases
            total_deaths += row.new_deaths
            row.total_cases = total_cases
            row.total_deaths = total_deaths
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
            if (key === "iso_code" && !row.iso_code) {
                if (row.location === "World") row.iso_code = "OWID_WRL"
                else if (row.location === "International")
                    row.iso_code = "OWID_INT"
            }
        })
        newRow.entityName = row.location
        newRow.entityCode = row.iso_code
        newRow.day = dateToYear(row.date)
        newRow.entityId = CovidExplorerTable.getEntityGuid(row.location)

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

const dateToYear = (dateString: string): number =>
    dateDiffInDays(
        moment.utc(dateString).toDate(),
        moment.utc("2020-01-21").toDate()
    )

export const covidDataPath =
    "https://covid.ourworldindata.org/data/owid-covid-data.csv"
export const covidLastUpdatedPath =
    "https://covid.ourworldindata.org/data/owid-covid-data-last-updated-timestamp.txt"

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
