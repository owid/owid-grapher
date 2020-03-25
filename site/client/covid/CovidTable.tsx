import * as React from "react"
import { observable, action, computed } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"

import {
    throttle,
    entries,
    groupBy,
    sortBy,
    maxBy,
    orderBy,
    partition,
    max,
    addDays,
    extend
} from "charts/Util"

import { DEFAULT_SORT_ORDER } from "./CovidConstants"

import {
    CovidSortKey,
    CovidSeries,
    CovidCountrySeries,
    DateRange,
    SortOrder,
    CovidCountryDatum
} from "./CovidTypes"

import { getDoublingRange, sortAccessors, inverseSortOrder } from "./CovidUtils"

import { CovidTableRow } from "./CovidTableRow"
import {
    CovidTableColumnKey,
    CovidTableHeaderSpec,
    columns,
    CovidTableCellSpec
} from "./CovidTableColumns"
import { fetchECDCData } from "./CovidFetch"
import { scaleLinear, schemeCategory10 } from "d3"
import { fromPairs, uniq } from "lodash"

export class CovidTableState {
    @observable.ref sortKey: CovidSortKey = CovidSortKey.totalCases
    @observable.ref sortOrder: SortOrder = SortOrder.desc
    @observable.ref isMobile: boolean = false

    constructor(state: Partial<CovidTableState>) {
        extend(this, state)
    }
}

export interface CovidTableProps {
    columns: CovidTableColumnKey[]
    mobileColumns: CovidTableColumnKey[]
    defaultState: Partial<CovidTableState>
    filter: (datum: CovidCountryDatum) => any
    loadData: () => Promise<CovidSeries>
    preloadData?: CovidSeries
    extraRow?: (props: CovidTableCellSpec) => JSX.Element | undefined
    footer?: JSX.Element
}

@observer
export class CovidTable extends React.Component<CovidTableProps> {
    static defaultProps: CovidTableProps = {
        columns: [],
        mobileColumns: [],
        filter: d => d,
        loadData: fetchECDCData,
        defaultState: {}
    }

    @observable.ref data: CovidSeries | undefined =
        this.props.preloadData ?? undefined

    @observable.ref isLoaded: boolean = !!this.props.preloadData
    @observable.ref isLoading: boolean = false
    @observable.ref error: string | undefined = undefined

    @observable tableState = new CovidTableState(this.props.defaultState)

    componentDidMount() {
        if (!this.props.preloadData) {
            this.loadData()
        }
        this.onResizeThrottled = throttle(this.onResize, 400)
        window.addEventListener("resize", this.onResizeThrottled)
        this.onResize()
    }

    componentWillUnmount() {
        if (this.onResizeThrottled) {
            window.removeEventListener("resize", this.onResizeThrottled)
        }
    }

    onResizeThrottled?: () => void

    @action.bound onResize() {
        this.tableState.isMobile = window.innerWidth <= 680
    }

    async loadData() {
        this.isLoading = true
        try {
            this.data = await this.props.loadData()
            this.isLoaded = true
            this.error = undefined
        } catch (error) {
            this.error = error && error.message
        }
        this.isLoading = false
    }

    @computed get countrySeries(): CovidCountrySeries {
        if (this.data) {
            return entries(groupBy(this.data, d => d.location)).map(
                ([location, series]) => {
                    const sortedSeries: CovidSeries = sortBy(
                        series,
                        d => d.date
                    )
                    return {
                        id: location,
                        location: location,
                        series: sortedSeries,
                        latest: maxBy(series, d => d.date),
                        latestWithTests: maxBy(
                            series.filter(d => d.tests),
                            d => d.date
                        ),
                        caseDoublingRange: getDoublingRange(
                            sortedSeries,
                            d => d.totalCases
                        ),
                        deathDoublingRange: getDoublingRange(
                            sortedSeries,
                            d => d.totalDeaths
                        )
                    }
                }
            )
        }
        return []
    }

    @computed get rowData() {
        const { sortKey, sortOrder } = this.tableState
        const accessor = sortAccessors[sortKey]
        const sortedSeries = orderBy(
            this.countrySeries,
            d => {
                const value = accessor(d)
                // In order for undefined values to always be last, we map them to +- Infinity
                return value !== undefined
                    ? value
                    : sortOrder === SortOrder.asc
                    ? Infinity
                    : -Infinity
            },
            sortOrder
        )
        const [shown, hidden] = partition(sortedSeries, this.props.filter)
        return { shown, hidden }
    }

    @computed get dateRange(): DateRange {
        const difference = this.tableState.isMobile ? 13 : 20 // inclusive, so 21 days technically
        if (this.data !== undefined && this.data.length > 0) {
            const maxDate = max(this.data.map(d => d.date)) as Date
            const minDate = addDays(maxDate, -difference)
            return [minDate, maxDate]
        }
        return [addDays(new Date(), -difference), new Date()]
    }

    @computed get lastUpdated(): Date | undefined {
        return this.dateRange[1]
    }

    @computed get totalTestsBarScale() {
        const maxTests = max(this.data?.map(d => d.tests?.totalTests))
        return scaleLinear()
            .domain([0, maxTests ?? 1])
            .range([0, 1])
    }

    @computed get columns(): CovidTableColumnKey[] {
        return this.tableState.isMobile
            ? this.props.mobileColumns
            : this.props.columns
    }

    @action.bound onSort(newKey: CovidSortKey) {
        const { sortKey, sortOrder } = this.tableState
        this.tableState.sortOrder =
            sortKey === newKey && sortOrder === DEFAULT_SORT_ORDER
                ? inverseSortOrder(DEFAULT_SORT_ORDER)
                : DEFAULT_SORT_ORDER
        this.tableState.sortKey = newKey
    }

    @computed get headerCellProps(): CovidTableHeaderSpec {
        const { sortKey, sortOrder, isMobile } = this.tableState
        return {
            currentSortKey: sortKey,
            currentSortOrder: sortOrder,
            isMobile: isMobile,
            lastUpdated: this.lastUpdated,
            onSort: this.onSort
        }
    }

    @computed get countryColors(): Record<string, string> {
        const locations = uniq((this.data || []).map(d => d.location))
        const colors = schemeCategory10
        return fromPairs(
            locations.map((l, i) => [l, colors[i % colors.length]])
        )
    }

    render() {
        if (this.isLoading) {
            return null
        }
        if (this.error) {
            return (
                <div className="covid-error">
                    There was an error loading the live table.
                </div>
            )
        }
        return (
            <div
                className={classnames("covid-table-container", {
                    "covid-table-mobile": this.tableState.isMobile
                })}
            >
                <table className="covid-table">
                    <thead>
                        <tr>
                            {this.columns.map(key => (
                                <React.Fragment key={key}>
                                    {columns[key].header(this.headerCellProps)}
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {this.rowData.shown.map(datum => (
                            <CovidTableRow
                                key={datum.id}
                                datum={datum}
                                columns={this.columns}
                                transform={{
                                    dateRange: this.dateRange,
                                    totalTestsBarScale: this.totalTestsBarScale,
                                    countryColors: this.countryColors
                                }}
                                extraRow={this.props.extraRow}
                                state={this.tableState}
                            />
                        ))}
                    </tbody>
                </table>
                <div className="covid-table-footer">{this.props.footer}</div>
            </div>
        )
    }
}
