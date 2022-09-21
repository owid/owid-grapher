import React from "react"
import { observable, action, computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { scaleLinear } from "d3-scale"
import { schemeCategory10 } from "d3-scale-chromatic"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faAngleDoubleDown } from "@fortawesome/free-solid-svg-icons/faAngleDoubleDown"
import {
    throttle,
    groupBy,
    sortBy,
    maxBy,
    orderBy,
    partition,
    max,
    addDays,
    extend,
    uniq,
    stringifyUnkownError,
} from "../../clientUtils/Util.js"
import { SortOrder } from "../../coreTable/CoreTableConstants.js"
import { DEFAULT_SORT_ORDER } from "./CovidConstants.js"
import {
    CovidSortKey,
    CovidSeries,
    CovidCountrySeries,
    DateRange,
    CovidCountryDatum,
} from "./CovidTypes.js"
import {
    getDoublingRange,
    sortAccessors,
    inverseSortOrder,
} from "./CovidUtils.js"
import { CovidTableRow } from "./CovidTableRow.js"
import {
    CovidTableColumnKey,
    CovidTableHeaderSpec,
    columns,
    CovidTableCellSpec,
} from "./CovidTableColumns.js"
import { fetchJHUData } from "./CovidFetch.js"

export class CovidTableState {
    sortKey: CovidSortKey = CovidSortKey.totalCases
    sortOrder: SortOrder = SortOrder.desc
    isMobile: boolean = false
    truncate: boolean = false
    truncateLength: number = 12

    constructor(state: Partial<CovidTableState>) {
        makeObservable(this, {
            sortKey: observable.ref,
            sortOrder: observable.ref,
            isMobile: observable.ref,
            truncate: observable.ref,
            truncateLength: observable.ref,
        })

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

export const CovidTable = observer(
    class CovidTable extends React.Component<CovidTableProps> {
        static defaultProps: CovidTableProps = {
            columns: [],
            mobileColumns: [],
            filter: (d) => d,
            loadData: fetchJHUData,
            defaultState: {},
        }

        data: CovidSeries | undefined = this.props.preloadData ?? undefined

        isLoaded: boolean = !!this.props.preloadData
        isLoading: boolean = false
        error: string | undefined = undefined

        tableState = new CovidTableState(this.props.defaultState)

        constructor(props: CovidTableProps) {
            super(props)

            makeObservable(this, {
                data: observable.ref,
                isLoaded: observable.ref,
                isLoading: observable.ref,
                error: observable.ref,
                tableState: observable,
                onResize: action.bound,
                countrySeries: computed,
                rowData: computed,
                isTruncated: computed,
                dateRange: computed,
                lastUpdated: computed,
                totalTestsBarScale: computed,
                columns: computed,
                onSort: action.bound,
                headerCellProps: computed,
                countryColors: computed,
                onShowMore: action.bound,
            })
        }

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

        onResize() {
            this.tableState.isMobile = window.innerWidth <= 680
        }

        async loadData() {
            this.isLoading = true
            try {
                this.data = await this.props.loadData()
                this.isLoaded = true
                this.error = undefined
            } catch (error) {
                this.error = stringifyUnkownError(error)
            }
            this.isLoading = false
        }

        get countrySeries(): CovidCountrySeries {
            if (this.data) {
                return Object.entries(
                    groupBy(this.data, (d) => d.location)
                ).map(([location, series]) => {
                    const sortedSeries: CovidSeries = sortBy(
                        series,
                        (d) => d.date
                    )
                    return {
                        id: location,
                        location: location,
                        series: sortedSeries,
                        latest: maxBy(series, (d) => d.date),
                        latestWithTests: maxBy(
                            series.filter((d) => d.tests),
                            (d) => d.date
                        ),
                        caseDoublingRange: getDoublingRange(
                            sortedSeries,
                            (d) => d.totalCases
                        ),
                        deathDoublingRange: getDoublingRange(
                            sortedSeries,
                            (d) => d.totalDeaths
                        ),
                    }
                })
            }
            return []
        }

        get rowData() {
            const { sortKey, sortOrder, truncate, truncateLength } =
                this.tableState
            const accessor = sortAccessors[sortKey]
            const sortedSeries = orderBy(
                this.countrySeries,
                (d) => {
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
            const [rest, hidden]: CovidCountrySeries[] = partition(
                sortedSeries,
                this.props.filter
            )

            let [shown, truncated]: CovidCountrySeries[] = [rest, []]
            if (truncate) {
                ;[shown, truncated] = [
                    rest.slice(0, truncateLength),
                    rest.slice(truncateLength),
                ]
            }

            return {
                shown,
                truncated,
                hidden,
            }
        }

        get isTruncated() {
            return this.rowData.truncated.length > 0
        }

        get dateRange(): DateRange {
            const difference = this.tableState.isMobile ? 13 : 20 // inclusive, so 21 days technically
            if (this.data !== undefined && this.data.length > 0) {
                const maxDate = max(this.data.map((d) => d.date)) as Date
                const minDate = addDays(maxDate, -difference)
                return [minDate, maxDate]
            }
            return [addDays(new Date(), -difference), new Date()]
        }

        get lastUpdated(): Date | undefined {
            return this.dateRange[1]
        }

        get totalTestsBarScale() {
            const maxTests = max(this.data?.map((d) => d.tests?.totalTests))
            return scaleLinear()
                .domain([0, maxTests ?? 1])
                .range([0, 1])
        }

        get columns(): CovidTableColumnKey[] {
            return this.tableState.isMobile
                ? this.props.mobileColumns
                : this.props.columns
        }

        onSort(newKey: CovidSortKey) {
            const { sortKey, sortOrder } = this.tableState
            this.tableState.sortOrder =
                sortKey === newKey && sortOrder === DEFAULT_SORT_ORDER
                    ? inverseSortOrder(DEFAULT_SORT_ORDER)
                    : DEFAULT_SORT_ORDER
            this.tableState.sortKey = newKey
        }

        get headerCellProps(): CovidTableHeaderSpec {
            const { sortKey, sortOrder, isMobile } = this.tableState
            return {
                currentSortKey: sortKey,
                currentSortOrder: sortOrder,
                isMobile: isMobile,
                lastUpdated: this.lastUpdated,
                onSort: this.onSort,
            }
        }

        get countryColors(): Map<string, string> {
            const locations = uniq((this.data || []).map((d) => d.location))
            const colors = schemeCategory10
            return new Map(
                locations.map((l, i) => [l, colors[i % colors.length]])
            )
        }

        onShowMore() {
            this.tableState.truncate = false
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
                        "covid-table-mobile": this.tableState.isMobile,
                    })}
                >
                    <div
                        className={classnames("covid-table-wrapper", {
                            truncated: this.isTruncated,
                        })}
                    >
                        <table className="covid-table">
                            <thead>
                                <tr>
                                    {this.columns.map((key) => (
                                        <React.Fragment key={key}>
                                            {columns[key].header(
                                                this.headerCellProps
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {this.rowData.shown.map((datum) => (
                                    <CovidTableRow
                                        key={datum.id}
                                        datum={datum}
                                        columns={this.columns}
                                        transform={{
                                            dateRange: this.dateRange,
                                            totalTestsBarScale:
                                                this.totalTestsBarScale,
                                            countryColors: this.countryColors,
                                        }}
                                        extraRow={this.props.extraRow}
                                        state={this.tableState}
                                    />
                                ))}
                            </tbody>
                        </table>
                        {this.isTruncated && (
                            <div
                                className="show-more"
                                onClick={this.onShowMore}
                            >
                                <button className="button">
                                    <span className="icon">
                                        <FontAwesomeIcon
                                            icon={faAngleDoubleDown}
                                        />
                                    </span>
                                    Show more
                                    <span className="icon">
                                        <FontAwesomeIcon
                                            icon={faAngleDoubleDown}
                                        />
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="covid-table-footer">
                        {this.props.footer}
                    </div>
                </div>
            )
        }
    }
)
