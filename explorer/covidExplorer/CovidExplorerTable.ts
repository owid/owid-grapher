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
    CovidColumnDefObjectMap,
    CovidConstrainedQueryParams,
    CovidQueryParams,
    makeColumnDefFromParams,
    makeColumnDefTemplates,
} from "./CovidParams"
import {
    CovidRow,
    IntervalOptions,
    intervalsAvailableByMetric,
    intervalSpecs,
    MegaRow,
    MetricOptions,
    SmoothingOption,
    testRateExcludeList,
} from "./CovidConstants"
import {
    calculateCovidRowsForGroup,
    computeRollingAveragesForEachGroup,
    euCountries,
    megaDateToTime,
} from "./CovidExplorerUtils"
import { CovidAnnotationColumnDefs } from "./CovidAnnotations"
import { CoreTable } from "coreTable/CoreTable"

export class CovidExplorerTable extends OwidTable {
    static fromMegaRows(megaRows: MegaRow[]) {
        const coreTable = new CoreTable<MegaRow>(megaRows)
            .withRenamedColumn("location", OwidTableSlugs.entityName)
            .withRenamedColumn("iso_code", OwidTableSlugs.entityCode)
            .filter(
                (row: MegaRow) => row.location !== "International",
                "Drop International rows"
            )
            .withColumns([
                {
                    slug: OwidTableSlugs.time,
                    type: ColumnTypeNames.Date,
                    fn: ((row: MegaRow) => megaDateToTime(row.date)) as any,
                }, // todo: improve typings on ColumnFn.
            ])

        // todo: this can be better expressed as a group + reduce.
        const continentGroups = coreTable.get("continent")!.valuesToRows
        const continentNames = Array.from(continentGroups.keys()).filter(
            (cont) => cont
        )

        const continentRows = flatten(
            continentNames.map((continentName) => {
                const rows = Array.from(
                    continentGroups.get(continentName)!.values()
                ) as CovidRow[]
                return calculateCovidRowsForGroup(rows, continentName)
            })
        )

        const euRows = calculateCovidRowsForGroup(
            coreTable.findRows({ entityName: euCountries }) as any,
            "European Union"
        )

        // Drop the last day in aggregates containing Spain & Sweden
        euRows.pop()

        const tableWithRows = coreTable
            .withRows(
                continentRows as any,
                `Added ${continentRows.length} continent rows`
            )
            .withRows(euRows as any, `Added ${euRows.length} EU rows`)

        return new CovidExplorerTable(
            (tableWithRows.rows as any) as CovidRow[], // todo: clean up typings
            tableWithRows.defs,
            tableWithRows as any,
            "Loaded into CovidExplorerTable"
        )
    }

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
        this.columnDefTemplates = cloneDeep(
            makeColumnDefTemplates(defsFromBackend)
        )
        return this
    }

    withAnnotationColumns() {
        return this.withColumns(CovidAnnotationColumnDefs) as CovidExplorerTable
    }

    // Todo: does this need to be observable?
    private columnDefTemplates = makeColumnDefTemplates()

    withDataTableDefs() {
        // todo: we might not need this "opt out", since we now explicitly list the columns to show in the table
        const includeInDataTable = new Set(Object.values(MetricOptions))
        return this.withTransformedDefs((def) => {
            if (includeInDataTable.has(def.slug as MetricOptions)) return def
            return {
                ...def,
                display: { includeInTable: false },
            }
        }) as CovidExplorerTable // todo: fix typings
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
        let averages: number[]

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
                return val ? val * (multiplyByWindowSize ? windowSize : 1) : val
            const previousValue = averages[index! - windowSize]
            return previousValue === undefined || previousValue === 0
                ? undefined
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
        return this.filter(
            (row) => !(row[slug] < 0),
            `Filter negative values for ${slug}`
        ) as CovidExplorerTable
    }

    filterGroups() {
        // "World" and our previously aggregated groups we sometimes want to filter out.
        return this.filter(
            (row) =>
                row.entityName === "World"
                    ? this.isSelected(row)
                    : !row.group_members || this.isSelected(row),
            `Filter out regions unless selected`
        ) as CovidExplorerTable
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
                        return undefined

                    if (testRateExcludeList.has(row.entityName))
                        return undefined

                    const tpc = row.new_tests_smoothed / (row as any)[casesSlug]
                    return tpc >= 1 ? tpc : undefined
                }),
            ]
        }

        if (params.interval === IntervalOptions.total)
            return [
                this.makeColumnDef(params, (row) => {
                    if (row.total_tests === undefined || !row.total_cases)
                        return undefined

                    if (testRateExcludeList.has(row.entityName))
                        return undefined

                    const tpc = row.total_tests / row.total_cases
                    return tpc >= 1 ? tpc : undefined
                }),
            ]

        return []
    }

    makeCfrColumnDef(params: CovidConstrainedQueryParams) {
        // We do not support daily freq for CFR
        if (params.interval === IntervalOptions.total)
            return this.makeColumnDef(params, (row) =>
                row.total_cases < 100
                    ? undefined
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
                        return undefined

                    if (!testCount) return undefined

                    const rate = cases / testCount
                    return rate >= 0 && rate <= 1 ? rate : undefined
                }),
            ]
        }
        return [
            this.makeColumnDef(params, (row) => {
                if (row.total_cases === undefined || !row.total_tests)
                    return undefined

                if (testRateExcludeList.has(row.entityName)) return undefined

                const rate = row.total_cases / row.total_tests
                return rate >= 0 && rate <= 1 ? rate : undefined
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

    withRequestedColumns(params: CovidConstrainedQueryParams) {
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
        return this.withColumns(defs.filter(isPresent)) as CovidExplorerTable
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
                        return undefined
                    currentCountry = row.entityName
                    countryExceededThresholdOnDay = row[OwidTableSlugs.time]
                }
                return row[OwidTableSlugs.time] - countryExceededThresholdOnDay
            },
        }
    }
}
