import { cloneDeep, flatten, isPresent } from "grapher/utils/Util"
import { OwidTable } from "coreTable/OwidTable"
import { OwidColumnDef, OwidTableSlugs } from "coreTable/OwidTableConstants"
import {
    ColumnTypeNames,
    ColumnSlug,
    Integer,
    CoreRow,
    ColumnFn,
    CoreColumnDef,
} from "coreTable/CoreTableConstants"
import {
    allAvailableQueryStringCombos,
    CovidColumnDefObjectMap,
    CovidConstrainedQueryParams,
    CovidQueryParams,
    makeColumnDefFromParams,
    makeColumnDefTemplates,
} from "./CovidParams"
import {
    IntervalOptions,
    intervalsAvailableByMetric,
    intervalSpecs,
    MetricOptions,
    SmoothingOption,
    testRateExcludeList,
} from "./CovidConstants"
import { computeRollingAveragesForEachGroup } from "./CovidExplorerUtils"
import { WorldEntityName } from "grapher/core/GrapherConstants"
import { InvalidCell } from "coreTable/InvalidCells"

class NotApplicableCell extends InvalidCell {}
class TestRateExclusionList extends InvalidCell {}
class NoTestData extends InvalidCell {}
class TestRateTooHigh extends InvalidCell {}
class TestRateTooLow extends InvalidCell {}
class UndefinedValue extends InvalidCell {}
class UnableToCompute extends InvalidCell {} // a catchall out of laziness

const CovidCellTypes = {
    BelowDeathsThreshold: new NotApplicableCell(),
    TestRateExclusionList: new TestRateExclusionList(),
    NoTestData: new NoTestData(),
    TestRateTooHigh: new TestRateTooHigh(),
    TestRateTooLow: new TestRateTooLow(),
    UnableToCompute: new UnableToCompute(),
    UndefinedValue: new UndefinedValue(),
}

export class CovidExplorerTable extends OwidTable {
    get mainTable(): CovidExplorerTable {
        return this.parent && this.parent instanceof CovidExplorerTable
            ? this.parent.mainTable
            : this
    }

    // Ideally we would just have 1 set of column specs. Currently however we have some statically coded, some coming from the Grapher backend, and some
    // generated on the fly. These "template specs" are used in the generation of new specs on the fly. Todo: cleanup.
    loadColumnDefTemplatesFromGrapherBackend(
        defsFromBackend: CovidColumnDefObjectMap
    ) {
        this._columnDefTemplates = cloneDeep(
            makeColumnDefTemplates(defsFromBackend)
        )
        return this
    }

    // todo: ideally we can simplify this when we do data 2.0
    get columnDefTemplates(): CovidColumnDefObjectMap {
        return (
            this._columnDefTemplates ??
            this.parent?.columnDefTemplates ??
            makeColumnDefTemplates()
        )
    }

    private _columnDefTemplates?: CovidColumnDefObjectMap

    updateColumnsToHideInDataTable() {
        // todo: we might not need this "opt out", since we now explicitly list the columns to show in the table
        const includeInDataTable = new Set(Object.values(MetricOptions))
        return this.updateDefs((def) => {
            if (includeInDataTable.has(def.slug as MetricOptions)) return def
            return {
                ...def,
                display: { includeInTable: false },
            }
        })
    }

    private makeColumnDef(
        params: CovidConstrainedQueryParams,
        rowFn: ColumnFn
    ) {
        const def = makeColumnDefFromParams(params, this.columnDefTemplates)
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
                if (value === undefined) return CovidCellTypes.UndefinedValue
                return row.population
                    ? perCapitaAdjustment * (value / row.population)
                    : undefined
            }
        }

        if (smoothing && !alreadySmoothed)
            return this.makeRollingAverageColumnDef(
                def,
                rowFn,
                smoothing,
                params.isWeekly || params.isBiweekly,
                params.intervalChange !== undefined
            )
        def.fn = rowFn
        return def
    }

    private makeNewCasesSmoothedColumnDef(smoothing: SmoothingOption) {
        return this.makeRollingAverageColumnDef(
            {
                slug: `new_cases_smoothed_${smoothing}day`,
                type: ColumnTypeNames.Ratio,
            },
            (row) => row.new_cases,
            smoothing
        )
    }

    // todo: remove these ops from here and move to CoreTable
    makeRollingAverageColumnDef(
        def: CoreColumnDef,
        valueAccessor: (row: CoreRow) => any,
        windowSize: Integer,
        multiplyByWindowSize = false,
        convertToPercentChangeOverWindow = false
    ) {
        let averages: (number | InvalidCell)[]

        def.fn = (row, index) => {
            if (!averages)
                averages = computeRollingAveragesForEachGroup(
                    this.rows,
                    valueAccessor,
                    OwidTableSlugs.entityName,
                    OwidTableSlugs.time,
                    windowSize
                )
            const val = averages[index!]
            if (!convertToPercentChangeOverWindow)
                return val instanceof InvalidCell
                    ? val
                    : val * (multiplyByWindowSize ? windowSize : 1)
            const previousValue = averages[index! - windowSize]
            return previousValue instanceof InvalidCell ||
                previousValue === undefined ||
                previousValue === 0 ||
                val instanceof InvalidCell
                ? CovidCellTypes.UndefinedValue
                : (100 * (val - previousValue)) / previousValue
        }

        return def
    }

    columnSlugsToShowInDataTable(params: CovidConstrainedQueryParams) {
        return this.paramsForDataTableColumns(params).map(
            (params) =>
                makeColumnDefFromParams(params, this.columnDefTemplates).slug
        )
    }

    appendEveryColumn() {
        const defs = flatten(
            allAvailableQueryStringCombos().map((str) =>
                this.makeColumnDefsFromParams(
                    new CovidQueryParams(str).toConstrainedParams()
                )
            )
        )
        return this.appendColumnsIfNew(defs)
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

    makeColumnDefsForDataTable(params: CovidConstrainedQueryParams) {
        return flatten(
            this.paramsForDataTableColumns(params).map((params) =>
                this.makeColumnDefsFromParams(params)
            )
        ).map((def) => {
            if (!def.display) def.display = {}
            def.display.tolerance = 10
            return def
        })
    }

    filterNegatives(slug: ColumnSlug) {
        return this.filter(
            (row) => !(row[slug] < 0),
            `Filter negative values for ${slug}`
        )
    }

    filterGroups() {
        // "World" and our previously aggregated groups we sometimes want to filter out.
        return this.filter(
            (row) =>
                row.entityName === WorldEntityName
                    ? this.isSelected(row)
                    : !row.group_members || this.isSelected(row),
            `Filter out regions unless selected`
        )
    }

    makeTestingColumnDef(params: CovidConstrainedQueryParams) {
        if (params.interval === IntervalOptions.daily)
            return this.makeColumnDef(params, (row) => row.new_tests)
        if (params.interval === IntervalOptions.smoothed)
            return this.makeColumnDef(params, (row) => row.new_tests_smoothed)
        if (params.interval === IntervalOptions.total)
            return this.makeColumnDef(params, (row) => row.total_tests)
        return undefined
    }

    makeTestsPerCaseColumnDefs(params: CovidConstrainedQueryParams) {
        if (params.interval === IntervalOptions.smoothed) {
            const def = this.makeNewCasesSmoothedColumnDef(params.smoothing)
            const casesSlug = def.slug
            return [
                def,
                this.makeColumnDef(params, (row) => {
                    if (
                        row.new_tests_smoothed === undefined ||
                        !(row as any)[casesSlug]
                    )
                        return CovidCellTypes.UndefinedValue

                    if (testRateExcludeList.has(row.entityName))
                        return CovidCellTypes.TestRateExclusionList

                    const tpc = row.new_tests_smoothed / (row as any)[casesSlug]
                    return tpc >= 1 ? tpc : CovidCellTypes.UnableToCompute
                }),
            ]
        }

        if (params.interval === IntervalOptions.total)
            return [
                this.makeColumnDef(params, (row) => {
                    if (row.total_tests === undefined || !row.total_cases)
                        return CovidCellTypes.UnableToCompute

                    if (testRateExcludeList.has(row.entityName))
                        return CovidCellTypes.TestRateExclusionList

                    const tpc = row.total_tests / row.total_cases
                    return tpc >= 1 ? tpc : CovidCellTypes.UnableToCompute
                }),
            ]

        return []
    }

    makeCfrColumnDef(params: CovidConstrainedQueryParams) {
        // We do not support daily freq for CFR
        if (params.interval === IntervalOptions.total)
            return this.makeColumnDef(params, (row) =>
                row.total_cases < 100
                    ? CovidCellTypes.BelowDeathsThreshold
                    : row.total_deaths && row.total_cases
                    ? (100 * row.total_deaths) / row.total_cases
                    : 0
            )
        return undefined
    }

    makeCasesColumnDef(params: CovidConstrainedQueryParams) {
        return this.makeColumnDef(
            params,
            params.interval === IntervalOptions.total
                ? (row) => row.total_cases
                : (row) => row.new_cases
        )
    }

    makeShortTermPositivityRateColumnDefs() {
        // We init this column for the epi line colors on ScatterPlots
        const params = new CovidQueryParams("")
        params.smoothing = 7
        params.perCapita = false
        params.interval = IntervalOptions.smoothed
        params.positiveTestRate = true
        return this.makeTestRateColumnDefs(params.toConstrainedParams())
    }

    makeTestRateColumnDefs(params: CovidConstrainedQueryParams) {
        if (params.isDailyOrSmoothed) {
            const def = this.makeNewCasesSmoothedColumnDef(params.smoothing)
            const casesSlug = def.slug
            return [
                def,
                this.makeColumnDef(params, (row) => {
                    const testCount =
                        params.smoothing === 7
                            ? row.new_tests_smoothed
                            : row.new_tests

                    const cases =
                        params.smoothing === 7
                            ? (row as any)[casesSlug]
                            : row.new_cases

                    if (testRateExcludeList.has(row.entityName))
                        return CovidCellTypes.TestRateExclusionList

                    if (!testCount) return CovidCellTypes.NoTestData

                    const rate = cases / testCount
                    if (rate > 1) return CovidCellTypes.TestRateTooHigh
                    if (rate < 0) return CovidCellTypes.TestRateTooLow
                    return rate
                }),
            ]
        }
        return [
            this.makeColumnDef(params, (row) => {
                if (row.total_cases === undefined || !row.total_tests)
                    return CovidCellTypes.UnableToCompute

                if (testRateExcludeList.has(row.entityName))
                    return CovidCellTypes.TestRateExclusionList

                const rate = row.total_cases / row.total_tests

                if (rate > 1) return CovidCellTypes.TestRateTooHigh
                if (rate < 0) return CovidCellTypes.TestRateTooLow
                return rate
            }),
        ]
    }

    makeDeathsColumnDef(params: CovidConstrainedQueryParams) {
        return this.makeColumnDef(
            params,
            params.interval === IntervalOptions.total
                ? (row) => row.total_deaths
                : (row) => row.new_deaths
        )
    }

    makeColumnDefsFromParams(params: CovidConstrainedQueryParams) {
        const defs: (CoreColumnDef | undefined)[] = []
        if (params.casesMetric) defs.push(this.makeCasesColumnDef(params))
        if (params.deathsMetric) defs.push(this.makeDeathsColumnDef(params))
        if (params.testsMetric) defs.push(this.makeTestingColumnDef(params))
        if (params.testsPerCaseMetric)
            defs.push(...this.makeTestsPerCaseColumnDefs(params))
        if (params.cfrMetric) defs.push(this.makeCfrColumnDef(params))
        if (params.positiveTestRate)
            defs.push(...this.makeTestRateColumnDefs(params))

        // Init tests per case for the country picker
        const tpc = new CovidQueryParams("")
        tpc.interval = IntervalOptions.smoothed
        tpc.testsPerCaseMetric = true
        defs.push(...this.makeTestsPerCaseColumnDefs(tpc.toConstrainedParams()))

        if (params.aligned) {
            // If we are an aligned chart showing tests, we need to make a start of
            // pandemic column from deaths rate
            if (params.testsMetric) {
                const newParams = new CovidConstrainedQueryParams(
                    params.toString()
                )
                newParams.testsMetric = false
                newParams.deathsMetric = true
                defs.push(this.makeDeathsColumnDef(newParams))
            }

            const option = params.trajectoryColumnOption
            defs.push(
                this.makeDaysSinceColumnDef(
                    option.slug,
                    option.sourceSlug,
                    option.threshold,
                    option.name
                )
            )
        }
        return defs.filter(isPresent)
    }

    makeDaysSinceColumnDef(
        slug: ColumnSlug,
        sourceColumnSlug: ColumnSlug,
        threshold: number,
        title: string
    ): OwidColumnDef {
        let currentCountry: number
        let countryExceededThresholdOnDay: number
        return {
            ...this.columnDefTemplates.days_since,
            name: title,
            slug,
            fn: (row) => {
                // NB: This assumes rows sorted by country then time. Would be better to do that more explicitly.
                if (row.entityName !== currentCountry) {
                    const sourceValue = row[sourceColumnSlug]
                    if (sourceValue === undefined || sourceValue < threshold)
                        return CovidCellTypes.UnableToCompute
                    currentCountry = row.entityName
                    countryExceededThresholdOnDay = row[OwidTableSlugs.time]
                }
                return row[OwidTableSlugs.time] - countryExceededThresholdOnDay
            },
        }
    }
}
