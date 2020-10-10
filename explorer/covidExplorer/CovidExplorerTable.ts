import { cloneDeep } from "grapher/utils/Util"
import moment from "moment"
import { csvParse } from "d3-dsv"
import { OwidTable } from "coreTable/OwidTable"
import { EntityName, OwidColumnSpec } from "coreTable/OwidTableConstants"
import {
    ColumnTypeNames,
    ColumnSlug,
    Integer,
    CoreRow,
    ComputedColumnFn,
    CoreColumnSpec,
    HasComputedColumn,
} from "coreTable/CoreTableConstants"
import {
    CovidColumnSpecObjectMap,
    CovidConstrainedQueryParams,
    CovidQueryParams,
    makeColumnSpecFromParams,
    makeColumnSpecTemplates,
} from "./CovidParams"
import {
    covidAnnotations,
    IntervalOptions,
    intervalsAvailableByMetric,
    intervalSpecs,
    MetricOptions,
    SmoothingOption,
    testRateExcludeList,
} from "./CovidConstants"
import { computeRollingAveragesForEachGroup } from "./CovidExplorerUtils"

interface AnnotationsRow {
    location: EntityName
    date: string
    cases_series_annotations: string
    deaths_series_annotations: string
}

const dontIncludeInTable = { display: { includeInTable: false } }

export class CovidExplorerTable extends OwidTable {
    // Ideally we would just have 1 set of column specs. Currently however we have some statically coded, some coming from the Grapher backend, and some
    // generated on the fly. These "template specs" are used in the generation of new specs on the fly. Todo: cleanup.
    loadColumnSpecTemplatesFromGrapherBackend(
        specsFromBackend: CovidColumnSpecObjectMap
    ) {
        this.columnSpecTemplates = cloneDeep(
            makeColumnSpecTemplates(specsFromBackend)
        )
        return this
    }

    // Todo: does this need to be observable?
    private columnSpecTemplates = makeColumnSpecTemplates()

    withDataTableSpecs() {
        // todo: we might not need this "opt out", since we now explicitly list the columns to show in the table
        const includeInDataTable = new Set(Object.values(MetricOptions))
        return this.withTransformedSpecs((spec) => {
            if (includeInDataTable.has(spec.slug as MetricOptions)) return spec
            return {
                ...spec,
                ...dontIncludeInTable,
            }
        }) as CovidExplorerTable // todo: fix typings
    }

    withAnnotationColumns() {
        const caseSlug = "cases_series_annotations"
        const deathSlug = "deaths_series_annotations"
        const cfrSlug = "case_fatality_rate_series_annotations"
        const table = this.withColumns([
            {
                slug: caseSlug,
                type: ColumnTypeNames.SeriesAnnotation,
                ...dontIncludeInTable,
            },
            {
                slug: deathSlug,
                type: ColumnTypeNames.SeriesAnnotation,
                ...dontIncludeInTable,
            },
            {
                slug: cfrSlug,
                type: ColumnTypeNames.SeriesAnnotation,
                ...dontIncludeInTable,
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

    private withColumn(
        params: CovidConstrainedQueryParams,
        rowFn: ComputedColumnFn
    ): CovidExplorerTable {
        const spec = makeColumnSpecFromParams(params, this.columnSpecTemplates)
        if (this.has(spec.slug)) return this

        const { metricName, perCapitaAdjustment, smoothing } = params

        // The 7 day test smoothing is already calculated, so for now just reuse that instead of recalculating.
        const alreadySmoothed =
            (metricName === MetricOptions.tests ||
                metricName === MetricOptions.tests_per_case ||
                metricName === MetricOptions.positive_test_rate) &&
            smoothing === 7

        // todo: have perCapita column derived from regular column.
        if (perCapitaAdjustment > 1) {
            const originalRowFn = rowFn
            rowFn = (row) => {
                const value = originalRowFn(row)
                if (value === undefined) return undefined
                const pop = row.population
                if (!pop) {
                    console.log(
                        `Warning: Missing population for ${row.location}. Excluding from perCapita`
                    )
                    return undefined
                }
                return perCapitaAdjustment * (value / pop)
            }
        }

        if (smoothing && !alreadySmoothed)
            return this.withRollingAverageColumn(
                spec,
                rowFn,
                smoothing,
                params.isWeekly || params.isBiweekly,
                params.intervalChange !== undefined
            )

        spec.fn = rowFn
        return this.withColumns([spec]) as CovidExplorerTable
    }

    private withNewCasesSmoothedColumn(smoothing: SmoothingOption) {
        const slug = `new_cases_smoothed_${smoothing}day`
        if (this.has(slug)) return this
        return this.withRollingAverageColumn(
            {
                slug,
                type: ColumnTypeNames.Ratio,
            },
            (row) => row.new_cases,
            smoothing
        )
    }

    // todo: remove these ops from here and move to CoreTable
    withRollingAverageColumn(
        spec: CoreColumnSpec,
        valueAccessor: (row: CoreRow) => any,
        windowSize: Integer,
        multiplyByWindowSize = false,
        convertToPercentChangeOverWindow = false
    ) {
        const averages = computeRollingAveragesForEachGroup(
            this.rows,
            valueAccessor,
            "entityName",
            "day",
            windowSize
        )

        spec.fn = (row, index) => {
            const val = averages[index!]
            if (!convertToPercentChangeOverWindow)
                return val ? val * (multiplyByWindowSize ? windowSize : 1) : val
            const previousValue = averages[index! - windowSize]
            return previousValue === undefined || previousValue === 0
                ? undefined
                : (100 * (val - previousValue)) / previousValue
        }

        return this.withColumns([spec]) as CovidExplorerTable
    }

    columnSlugsToShowInDataTable(params: CovidConstrainedQueryParams) {
        return this.paramsForDataTableColumns(params).map(
            (params) =>
                makeColumnSpecFromParams(params, this.columnSpecTemplates).slug
        )
    }

    private paramsForDataTableColumns(params: CovidConstrainedQueryParams) {
        const { interval, tableMetrics, perCapita } = params
        const results: CovidConstrainedQueryParams[] = []
        tableMetrics?.forEach((metric) => {
            const dataTableParams = new CovidConstrainedQueryParams("")
            dataTableParams.setMetric(metric)
            dataTableParams.interval = IntervalOptions.total
            if (
                metric === MetricOptions.deaths ||
                metric === MetricOptions.cases ||
                metric === MetricOptions.tests
            ) {
                const requiredSourceColumn = new CovidConstrainedQueryParams("")
                requiredSourceColumn.setMetric(metric)
                requiredSourceColumn.interval = IntervalOptions.total
                requiredSourceColumn.perCapita = perCapita
                results.push(requiredSourceColumn)

                dataTableParams.perCapita = perCapita

                if (
                    interval !== IntervalOptions.total &&
                    intervalsAvailableByMetric.get(metric)?.has(interval)
                ) {
                    dataTableParams.interval = interval
                    dataTableParams.smoothing =
                        intervalSpecs[interval].smoothing
                }
            }

            results.push(dataTableParams)
        })
        return results
    }

    withDataTableColumnsInTable(params: CovidConstrainedQueryParams) {
        let table: CovidExplorerTable = this
        this.paramsForDataTableColumns(params).forEach((params) => {
            table = table.withRequestedColumns(params)
        })
        return table
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
        if (params.interval === IntervalOptions.daily)
            return this.withColumn(params, (row) => row.new_tests)
        if (params.interval === IntervalOptions.smoothed)
            return this.withColumn(params, (row) => row.new_tests_smoothed)
        if (params.interval === IntervalOptions.total)
            return this.withColumn(params, (row) => row.total_tests)
        return this
    }

    withTestsPerCaseColumn(params: CovidConstrainedQueryParams) {
        if (params.interval === IntervalOptions.smoothed) {
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

        if (params.interval === IntervalOptions.total)
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
        if (params.interval === IntervalOptions.total)
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
            params.interval === IntervalOptions.total
                ? (row) => row.total_cases
                : (row) => row.new_cases
        )
    }

    withShortTermPositivityRate() {
        // We init this column for the epi line colors on ScatterPlots
        const params = new CovidQueryParams("")
        params.smoothing = 7
        params.perCapita = false
        params.interval = IntervalOptions.smoothed
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
            params.interval === IntervalOptions.total
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
        tpc.interval = IntervalOptions.smoothed
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
}
