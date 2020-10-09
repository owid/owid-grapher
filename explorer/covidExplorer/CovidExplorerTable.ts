import { cloneDeep } from "grapher/utils/Util"
import moment from "moment"
import { csvParse } from "d3-dsv"
import { OwidTable } from "coreTable/OwidTable"
import {
    ColumnTypeNames,
    EntityName,
    ColumnSlug,
    Integer,
    CoreRow,
    ComputedColumnFn,
    CoreColumnSpec,
    HasComputedColumn,
} from "coreTable/CoreTableConstants"
import { CovidConstrainedQueryParams, CovidQueryParams } from "./CovidParams"
import {
    covidAnnotations,
    SmoothingOption,
    sourceVariables,
    testRateExcludeList,
} from "./CovidConstants"
import { computed, observable } from "mobx"
import { OwidColumnSpec } from "coreTable/OwidTableConstants"
import {
    buildColumnSlug,
    computeRollingAveragesForEachGroup,
} from "./CovidExplorerUtils"

interface AnnotationsRow {
    location: EntityName
    date: string
    cases_annotations: string
    deaths_annotations: string
}

export class CovidExplorerTable extends OwidTable {
    @observable private owidVariableSpecs: {
        [key: string]: OwidColumnSpec
    } = {}

    setOwidVariableSpecs(
        specs: {
            [key: string]: OwidColumnSpec
        } = {}
    ) {
        this.owidVariableSpecs = specs
        return this
    }

    // Ideally we would just have 1 set of column specs. Currently however we have some hard coded here, some coming from the Grapher backend, and some
    // generated on the fly. These "template specs" are used to generate specs on the fly. Todo: cleanup.
    @computed get columnSpecTemplates(): {
        [columnSlug: string]: OwidColumnSpec
    } {
        const { owidVariableSpecs } = this
        const templates = {
            positive_test_rate: {
                ...owidVariableSpecs[sourceVariables.positive_test_rate],
                isDailyMeasurement: true,
                description:
                    "The number of confirmed cases divided by the number of tests, expressed as a percentage. Tests may refer to the number of tests performed or the number of people tested – depending on which is reported by the particular country.",
            },
            tests_per_case: {
                ...owidVariableSpecs[sourceVariables.tests_per_case],
                isDailyMeasurement: true,
                description:
                    "The number of tests divided by the number of confirmed cases. Not all countries report testing data on a daily basis.",
            },
            case_fatality_rate: {
                ...owidVariableSpecs[sourceVariables.case_fatality_rate],
                // annotationsColumnSlug: "case_fatality_rate_annotations", // todo: readd annotations as a propety like size or color
                isDailyMeasurement: true,
                description: `The Case Fatality Rate (CFR) is the ratio between confirmed deaths and confirmed cases. During an outbreak of a pandemic the CFR is a poor measure of the mortality risk of the disease. We explain this in detail at OurWorldInData.org/Coronavirus`,
            },
            cases: {
                ...owidVariableSpecs[sourceVariables.cases],
                isDailyMeasurement: true,
                // annotationsColumnSlug: "cases_annotations",
                name: "Confirmed cases of COVID-19",
                description: `The number of confirmed cases is lower than the number of actual cases; the main reason for that is limited testing.`,
            },
            deaths: {
                ...owidVariableSpecs[sourceVariables.deaths],
                isDailyMeasurement: true,
                // annotationsColumnSlug: "deaths_annotations",
                name: "Confirmed deaths due to COVID-19",
                description: `Limited testing and challenges in the attribution of the cause of death means that the number of confirmed deaths may not be an accurate count of the true number of deaths from COVID-19.`,
            },
            tests: {
                ...owidVariableSpecs[sourceVariables.tests],
                isDailyMeasurement: true,
                description: "",
                name: "tests",
                // annotationsColumnSlug: "tests_units",
            },
            days_since: {
                ...owidVariableSpecs[sourceVariables.days_since],
                isDailyMeasurement: true,
                description: "",
                name: "days_since",
            },
            continents: {
                ...owidVariableSpecs[sourceVariables.continents],
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

    withAnnotationColumns() {
        const caseSlug = "cases_annotations"
        const deathSlug = "deaths_annotations"
        const cfrSlug = "case_fatality_rate_annotations"
        const table = this.withColumns([
            { slug: caseSlug, type: ColumnTypeNames.String },
            {
                slug: deathSlug,
                type: ColumnTypeNames.String,
            },
            {
                slug: cfrSlug,
                type: ColumnTypeNames.String,
            },
        ])

        const entityIndex = table.entityIndex
        const annotationRows = csvParse(covidAnnotations) as AnnotationsRow[]
        annotationRows.forEach((annoRow) => {
            const rows = entityIndex.get(annoRow.location)
            if (!rows) return
            // If no date on annotation apply to all rows
            const applyTo = annoRow.date
                ? rows.filter((row) => row.date === annoRow.date)
                : rows
            const datePrefix = annoRow.date
                ? moment(annoRow.date).format("MMM D") + ": "
                : ""
            applyTo.forEach((row) => {
                if (annoRow[caseSlug])
                    row[caseSlug] = datePrefix + annoRow[caseSlug]
                if (annoRow[deathSlug])
                    row[deathSlug] = datePrefix + annoRow[deathSlug]
                row[cfrSlug] = `${datePrefix}${annoRow[caseSlug] || ""}${
                    annoRow[deathSlug]
                }`
            })
        })
        return table as CovidExplorerTable
    }

    buildColumnSpec(params: CovidQueryParams): OwidColumnSpec {
        const name = params.metricName
        const perCapita = params.perCapitaAdjustment
        const interval = params.interval
        const rollingAverage = params.smoothing

        const spec = cloneDeep(this.columnSpecTemplates[name]) as OwidColumnSpec
        spec.slug = buildColumnSlug(name, perCapita, interval, rollingAverage)

        const messages: { [index: number]: string } = {
            1: "",
            1e3: " per thousand people",
            1e6: " per million people",
        }

        if (!spec.display) spec.display = {}

        spec.display!.name = `${params.intervalTitle} ${spec.display!.name}${
            messages[perCapita]
        }`

        // Show decimal places for rolling average & per capita variables
        if (perCapita > 1) spec.display!.numDecimalPlaces = 2
        else if (
            name === "positive_test_rate" ||
            name === "case_fatality_rate" ||
            (rollingAverage && rollingAverage > 1)
        )
            spec.display!.numDecimalPlaces = 1
        else spec.display!.numDecimalPlaces = 0

        return spec
    }

    private withColumn(
        params: CovidConstrainedQueryParams,
        rowFn: ComputedColumnFn
    ): CovidExplorerTable {
        const columnName = params.metricName
        const perCapita = params.perCapitaAdjustment
        const smoothing = params.smoothing
        const spec = this.buildColumnSpec(params)

        if (this.has(spec.slug)) return this

        // The 7 day test smoothing is already calculated, so for now just reuse that instead of recalculating.
        const alreadySmoothed =
            (columnName === "tests" ||
                columnName === "tests_per_case" ||
                columnName === "positive_test_rate") &&
            smoothing === 7

        // Per-capita transform done after rolling average to preserve precision.
        const perCapitaTransform =
            perCapita > 1
                ? (fn: ComputedColumnFn) => (row: CoreRow, index?: number) => {
                      const value = fn(row, index)
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
                : undefined

        if (smoothing && !alreadySmoothed)
            return this.withRollingAverageColumn(
                spec,
                smoothing,
                rowFn,
                "day",
                "entityName",
                params.rollingMultiplier,
                params.intervalChange,
                perCapitaTransform
            )

        return this.withColumns([
            {
                ...spec,
                fn: perCapitaTransform ? perCapitaTransform(rowFn) : rowFn,
            },
        ]) as CovidExplorerTable
    }

    // todo: make immutable? return a new table?
    // todo: this won't work when adding rows dynamically
    withRollingAverageColumn(
        spec: CoreColumnSpec,
        windowSize: Integer,
        valueAccessor: (row: CoreRow) => any,
        dateColName: ColumnSlug,
        groupBy: ColumnSlug,
        multiplier = 1,
        intervalChange?: number,
        transformation: (fn: ComputedColumnFn) => ComputedColumnFn = (fn) => (
            row,
            index
        ) => fn(row, index)
    ) {
        const averages = computeRollingAveragesForEachGroup(
            this.rows,
            valueAccessor,
            groupBy,
            dateColName,
            windowSize
        )

        const computeIntervalTotals: ComputedColumnFn = (row, index) => {
            const val = averages[index!]
            if (!intervalChange) return val ? val * multiplier : val
            const previousValue = averages[index! - intervalChange]
            return previousValue === undefined || previousValue === 0
                ? undefined
                : (100 * (val - previousValue)) / previousValue
        }

        return this.withColumns([
            {
                ...spec,
                fn: transformation(computeIntervalTotals),
            },
        ]) as CovidExplorerTable
    }

    filterNegatives(slug: ColumnSlug) {
        return this.filterBy(
            (row) => !(row[slug] < 0),
            `Filter negative values for ${slug}`
        ) as CovidExplorerTable
    }

    filterGroups() {
        return this.filterBy(
            (row) => !row.group_members || this.isSelected(row),
            `Filter out regions`
        ) as CovidExplorerTable
    }

    withTestingColumn(params: CovidConstrainedQueryParams) {
        if (params.interval === "daily")
            return this.withColumn(params, (row) => row.new_tests)
        if (params.interval === "smoothed")
            return this.withColumn(params, (row) => row.new_tests_smoothed)
        if (params.interval === "total")
            return this.withColumn(params, (row) => row.total_tests)
        return this
    }

    withTestsPerCaseColumn(params: CovidConstrainedQueryParams) {
        if (params.interval === "smoothed") {
            const table = this.withNewCasesSmoothedColumn(params.smoothing)
            const casesSlug = table.lastColumnSlug
            return table.withColumn(params, (row) => {
                if (
                    row.new_tests_smoothed === undefined ||
                    !(row as any)[casesSlug]
                )
                    return undefined

                if (testRateExcludeList.has(row.entityName)) return undefined

                const tpc = row.new_tests_smoothed / (row as any)[casesSlug]
                return tpc >= 1 ? tpc : undefined
            })
        }

        if (params.interval === "total")
            return this.withColumn(params, (row) => {
                if (row.total_tests === undefined || !row.total_cases)
                    return undefined

                if (testRateExcludeList.has(row.entityName)) return undefined

                const tpc = row.total_tests / row.total_cases
                return tpc >= 1 ? tpc : undefined
            })

        return this
    }

    withCfrColumn(params: CovidConstrainedQueryParams) {
        // We do not support daily freq for CFR
        if (params.interval === "total")
            return this.withColumn(params, (row) =>
                row.total_cases < 100
                    ? undefined
                    : row.total_deaths && row.total_cases
                    ? (100 * row.total_deaths) / row.total_cases
                    : 0
            )
        return this
    }

    withCasesColumn(params: CovidConstrainedQueryParams) {
        return this.withColumn(
            params,
            params.interval === "total"
                ? (row) => row.total_cases
                : (row) => row.new_cases
        )
    }

    withShortTermPositivityRate() {
        // We init this column for the epi line colors on ScatterPlots
        const params = new CovidQueryParams("")
        params.smoothing = 7
        params.perCapita = false
        params.interval = "smoothed"
        params.positiveTestRate = true
        return this.withTestRateColumn(params.toConstrainedParams())
    }

    withTestRateColumn(params: CovidConstrainedQueryParams) {
        if (params.isDailyOrSmoothed) {
            const table = this.withNewCasesSmoothedColumn(params.smoothing)
            const casesSlug = table.lastColumnSlug
            return table.withColumn(params, (row) => {
                const testCount =
                    params.smoothing === 7
                        ? row.new_tests_smoothed
                        : row.new_tests

                const cases =
                    params.smoothing === 7
                        ? (row as any)[casesSlug]
                        : row.new_cases

                if (testRateExcludeList.has(row.entityName)) return undefined

                if (!testCount) return undefined

                const rate = cases / testCount
                return rate >= 0 && rate <= 1 ? rate : undefined
            })
        }
        return this.withColumn(params, (row) => {
            if (row.total_cases === undefined || !row.total_tests)
                return undefined

            if (testRateExcludeList.has(row.entityName)) return undefined

            const rate = row.total_cases / row.total_tests
            return rate >= 0 && rate <= 1 ? rate : undefined
        })
    }

    withDeathsColumn(params: CovidConstrainedQueryParams) {
        return this.withColumn(
            params,
            params.interval === "total"
                ? (row) => row.total_deaths
                : (row) => row.new_deaths
        )
    }

    withRequestedColumns(params: CovidConstrainedQueryParams) {
        let table = this as CovidExplorerTable
        if (params.casesMetric) table = table.withCasesColumn(params)
        if (params.deathsMetric) table = table.withDeathsColumn(params)
        if (params.testsMetric) table = table.withTestingColumn(params)
        if (params.testsPerCaseMetric)
            table = table.withTestsPerCaseColumn(params)
        if (params.cfrMetric) table = table.withCfrColumn(params)
        if (params.positiveTestRate) table = table.withTestRateColumn(params)

        // Init tests per case for the country picker
        const tpc = new CovidQueryParams("")
        tpc.interval = "smoothed"
        tpc.testsPerCaseMetric = true
        table = table.withTestsPerCaseColumn(tpc.toConstrainedParams())

        if (params.aligned) {
            // If we are an aligned chart showing tests, we need to make a start of
            // pandemic column from deaths rate
            if (params.testsMetric) {
                const newParams = new CovidConstrainedQueryParams(
                    params.toString()
                )
                newParams.testsMetric = false
                newParams.deathsMetric = true
                table = table.withDeathsColumn(newParams)
            }

            const option = params.trajectoryColumnOption
            table = table.withDaysSinceColumn(
                option.slug,
                option.sourceSlug,
                option.threshold,
                option.name
            )
        }
        return table
    }

    withDaysSinceColumn(
        slug: string,
        sourceColumnSlug: string,
        threshold: number,
        title: string
    ) {
        const spec: OwidColumnSpec & HasComputedColumn = {
            ...this.columnSpecTemplates.days_since,
            name: title,
            slug,
            fn: (row) => {
                if (row.entityName !== currentCountry) {
                    const sourceValue = row[sourceColumnSlug]
                    if (sourceValue === undefined || sourceValue < threshold)
                        return undefined
                    currentCountry = row.entityName
                    countryExceededThresholdOnDay = row.day
                }
                return row.day - countryExceededThresholdOnDay
            },
        }

        let currentCountry: number
        let countryExceededThresholdOnDay: number
        return this.withColumns([spec]) as CovidExplorerTable
    }

    private withNewCasesSmoothedColumn(smoothing: SmoothingOption) {
        const slug = `new_cases_smoothed_${smoothing}day`
        if (this.has(slug)) return this
        return this.withRollingAverageColumn(
            {
                slug,
            },
            smoothing,
            (row) => row.new_cases,
            "day",
            "entityName"
        )
    }
}
