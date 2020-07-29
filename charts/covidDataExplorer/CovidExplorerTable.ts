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
    fetchText,
    fetchJSON
} from "charts/Util"
import moment from "moment"
import {
    ParsedCovidCsvRow,
    MetricKind,
    CountryOption,
    CovidGrapherRow,
    SmoothingOption,
    IntervalOption,
    intervalOptions
} from "./CovidTypes"
import { csv } from "d3-fetch"
import { csvParse } from "d3-dsv"
import {
    OwidTable,
    ComputedColumnSpec,
    RowToValueMapper,
    ColumnSpec,
    entityName,
    columnSlug,
    columnTypes
} from "charts/owidData/OwidTable"
import { CovidConstrainedQueryParams, CovidQueryParams } from "./CovidChartUrl"
import { covidAnnotations } from "./CovidAnnotations"
import {
    covidDataPath,
    covidLastUpdatedPath,
    covidChartAndVariableMetaPath,
    sourceVariables
} from "./CovidConstants"

type MetricKey = {
    [K in MetricKind]: number
}

interface AnnotationsRow {
    location: entityName
    date: string
    cases_annotations: string
    deaths_annotations: string
}

const stringColumnSlugs = new Set(
    `iso_code location date tests_units continent`.split(" ")
)

export const buildColumnSlug = (
    name: MetricKind,
    perCapita: number,
    interval: IntervalOption,
    rollingAverage?: number
) =>
    [
        name,
        perCapita === 1e3
            ? "perThousand"
            : perCapita === 1e6
            ? "perMil"
            : undefined,
        interval,
        rollingAverage ? rollingAverage + "DayAvg" : undefined
    ]
        .filter(i => i)
        .join("-")

export class CovidExplorerTable {
    table: OwidTable
    columnSpecs: { [name: string]: ColumnSpec } = {}

    constructor(
        table: OwidTable,
        data: CovidGrapherRow[],
        owidVariableSpecs = {},
        isStandalonePage = false
    ) {
        this.initColumnSpecs(owidVariableSpecs)
        this.table = table
        if (!isStandalonePage) this.table.cloneAndSetRows(data)
        else this.table.setRowsWithoutCloning(data)
        this.table.addSpecs(this.getBaseSpecs(data[0] || {}))
        this.table.columnsBySlug.forEach(col => {
            // Ensure all columns have a OwidVarId for now. Todo: rely on just column slug in Grapher.
            if (!col.spec.owidVariableId)
                col.spec = CovidExplorerTable.makeSpec(col.spec)
        })
        this.table.addCategoricalColumnSpec(this.columnSpecs.continents)
        this.addAnnotationColumns()
    }

    private getBaseSpecs(row: CovidGrapherRow) {
        return Object.keys(row).map(slug => {
            return {
                slug,
                type: stringColumnSlugs.has(slug)
                    ? "String"
                    : ("Numeric" as columnTypes)
            }
        })
    }

    private static colOwidVarIdGuid = 90210
    private static makeSpec(spec: ColumnSpec): ColumnSpec {
        return {
            owidVariableId: CovidExplorerTable.colOwidVarIdGuid++,
            unit: "",
            description: "",
            coverage: "",
            display: { includeInTable: false },
            datasetName: "",
            source: {
                id: 1,
                name: "",
                dataPublishedBy: "",
                dataPublisherSource: "",
                link: "",
                retrievedDate: "",
                additionalInfo: ""
            },
            ...spec
        }
    }

    private initColumnSpecs(owidVariableSpecs: any) {
        this.columnSpecs = {
            positive_test_rate: {
                ...owidVariableSpecs[sourceVariables.positive_test_rate],
                isDailyMeasurement: true,
                description:
                    "The number of confirmed cases divided by the number of tests, expressed as a percentage. Tests may refer to the number of tests performed or the number of people tested – depending on which is reported by the particular country."
            },
            tests_per_case: {
                ...owidVariableSpecs[sourceVariables.tests_per_case],
                isDailyMeasurement: true,
                description:
                    "The number of tests divided by the number of confirmed cases. Not all countries report testing data on a daily basis."
            },
            case_fatality_rate: {
                ...owidVariableSpecs[sourceVariables.case_fatality_rate],
                annotationsColumnSlug: "case_fatality_rate_annotations",
                isDailyMeasurement: true,
                description: `The Case Fatality Rate (CFR) is the ratio between confirmed deaths and confirmed cases. During an outbreak of a pandemic the CFR is a poor measure of the mortality risk of the disease. We explain this in detail at OurWorldInData.org/Coronavirus`
            },
            cases: {
                ...owidVariableSpecs[sourceVariables.cases],
                isDailyMeasurement: true,
                annotationsColumnSlug: "cases_annotations",
                name: "Confirmed cases of COVID-19",
                description: `The number of confirmed cases is lower than the number of actual cases; the main reason for that is limited testing.`
            },
            deaths: {
                ...owidVariableSpecs[sourceVariables.deaths],
                isDailyMeasurement: true,
                annotationsColumnSlug: "deaths_annotations",
                name: "Confirmed deaths due to COVID-19",
                description: `Limited testing and challenges in the attribution of the cause of death means that the number of confirmed deaths may not be an accurate count of the true number of deaths from COVID-19.`
            },
            tests: {
                ...owidVariableSpecs[sourceVariables.tests],
                isDailyMeasurement: true,
                description: "",
                name: "tests",
                annotationsColumnSlug: "tests_units"
            },
            days_since: {
                ...owidVariableSpecs[sourceVariables.days_since],
                isDailyMeasurement: true,
                description: "",
                name: "days_since"
            },
            continents: {
                ...owidVariableSpecs[sourceVariables.continents],
                description: "",
                name: "continent",
                slug: "continent"
            }
        }
        Object.keys(this.columnSpecs).forEach(key => {
            this.columnSpecs[key].owidVariableId = (sourceVariables as any)[key]
        })

        // Todo: move to the grapher specs?
        const ptrDisplay = this.columnSpecs.positive_test_rate.display
        if (ptrDisplay)
            ptrDisplay.tableDisplay = {
                hideRelativeChange: true
            } as any

        const cfrDisplay = this.columnSpecs.case_fatality_rate.display
        if (cfrDisplay)
            cfrDisplay.tableDisplay = {
                hideRelativeChange: true
            } as any
    }

    private addAnnotationColumns() {
        const caseSlug = "cases_annotations"
        const deathSlug = "deaths_annotations"
        const cfrSlug = "case_fatality_rate_annotations"
        this.table.addStringColumnSpec({ slug: caseSlug })
        this.table.addStringColumnSpec({
            slug: deathSlug
        })
        this.table.addStringColumnSpec({
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

    private static buildCovidVariableId(params: CovidQueryParams): number {
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
            names[params.metricName],
            intervalOptions.indexOf(params.interval),
            params.perCapitaDivisor,
            params.smoothing
        ]
        return parseInt(parts.join(""))
    }

    buildColumnSpec(params: CovidQueryParams): ColumnSpec {
        const name = params.metricName
        const perCapita = params.perCapitaDivisor
        const interval = params.interval
        const rollingAverage = params.smoothing

        const spec = cloneDeep(this.columnSpecs[name]) as ColumnSpec
        spec.slug = buildColumnSlug(name, perCapita, interval, rollingAverage)
        spec.owidVariableId = CovidExplorerTable.buildCovidVariableId(params)

        const messages: { [index: number]: string } = {
            1: "",
            1e3: " per thousand people",
            1e6: " per million people"
        }

        if (!spec.display) spec.display = {}

        spec.display!.name = `${params.intervalTitle} ${spec.display!.name}${
            messages[perCapita]
        }`

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
        const columnName = params.metricName
        const perCapita = params.perCapitaAdjustment
        const smoothing = params.smoothing
        const spec = this.buildColumnSpec(params)

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
                "entityName",
                params.rollingMultiplier,
                params.intervalChange
            )
        else table.addNumericComputedColumn({ ...spec, fn: rowFn })
        return spec
    }

    initTestingColumn(params: CovidConstrainedQueryParams) {
        if (params.interval === "daily")
            this.initColumn(params, row => row.new_tests)
        else if (params.interval === "smoothed")
            this.initColumn(params, row => row.new_tests_smoothed)
        else if (params.interval === "total")
            this.initColumn(params, row => row.total_tests)
    }

    initTestsPerCaseColumn(params: CovidConstrainedQueryParams) {
        if (params.interval === "smoothed") {
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
        } else if (params.interval === "total")
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
        if (params.interval === "total")
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
            params.interval === "total"
                ? row => row.total_cases
                : row => row.new_cases
        )
    }

    initAndGetShortTermPositivityRateVarId() {
        // We init this column for the epi line colors on ScatterPlots
        const params = new CovidQueryParams("")
        params.smoothing = 7
        params.perCapita = false
        params.interval = "smoothed"
        params.positiveTestRate = true
        const spec = this.initTestRateColumn(params.toConstrainedParams())
        return spec.owidVariableId!
    }

    initTestRateColumn(params: CovidConstrainedQueryParams) {
        if (params.isDailyOrSmoothed) {
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
            params.interval === "total"
                ? row => row.total_deaths
                : row => row.new_deaths
        )
    }

    private groupFilterSlug = "group_filter"
    addGroupFilterColumn() {
        if (!this.table.columnsBySlug.has(this.groupFilterSlug)) {
            this.table.addFilterColumn(
                this.groupFilterSlug,
                (row, index, table) =>
                    !row.group_members || table!.isSelected(row)
            )
        }
    }

    removeGroupFilterColumn() {
        this.table.deleteColumnBySlug(this.groupFilterSlug)
    }

    private negativeFilterSlug: columnSlug = ""
    addNegativeFilterColumn(slugName: columnSlug) {
        const filterSlug = "filter_negatives_in_" + slugName
        if (filterSlug !== this.negativeFilterSlug)
            this.removeNegativeFilterColumn()
        if (!this.table.columnsBySlug.has(filterSlug))
            this.table.addFilterColumn(filterSlug, row => !(row[slugName] < 0))
        this.negativeFilterSlug = filterSlug
    }

    removeNegativeFilterColumn() {
        if (this.negativeFilterSlug)
            this.table.deleteColumnBySlug(this.negativeFilterSlug)
        this.negativeFilterSlug = ""
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
                const newParams = new CovidConstrainedQueryParams(
                    params.toString()
                )
                newParams.testsMetric = false
                newParams.deathsMetric = true
                this.initDeathsColumn(newParams)
            }

            const option = params.trajectoryColumnOption
            this.addDaysSinceColumn(
                option.slug,
                option.sourceSlug,
                option.owidVariableId,
                option.threshold,
                option.name
            )
        }
    }

    addDaysSinceColumn(
        slug: string,
        sourceColumnSlug: string,
        id: number,
        threshold: number,
        title: string
    ) {
        const spec: ComputedColumnSpec = {
            ...this.columnSpecs.days_since,
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
        this.table.addNumericComputedColumn(spec)
        return slug
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
        const rows = sortBy(group, row => dateToYear(row.date))
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

    static parseCovidRow(row: ParsedCovidCsvRow): CovidGrapherRow {
        const newRow: Partial<CovidGrapherRow> = row
        Object.keys(row).forEach(key => {
            const isNumeric = !stringColumnSlugs.has(key)
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

export const fetchLastUpdatedTime = memoize(() =>
    retryPromise(() => fetchText(covidLastUpdatedPath))
)

export const fetchCovidChartAndVariableMeta = memoize(() =>
    retryPromise(() => fetchJSON(covidChartAndVariableMetaPath))
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

export function perCapitaDivisorByMetric(metric: MetricKind) {
    return metric === "tests" ? 1e3 : 1e6
}
