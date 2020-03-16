import * as React from "react"
import { observable, action, computed } from "mobx"
import { observer } from "mobx-react"
import { csvParse } from "d3"
import classnames from "classnames"

import { CovidTableHeaderCell as HeaderCell } from "./CovidTableHeaderCell"

import {
    throttle,
    entries,
    groupBy,
    sortBy,
    maxBy,
    orderBy,
    partition,
    max,
    fetchText,
    addDays
} from "charts/Util"

import { DATA_URL, CASE_THRESHOLD, DEFAULT_SORT_ORDER } from "./CovidConstants"

import {
    CovidAccessorKey,
    CovidSeries,
    CovidCountrySeries,
    DateRange,
    SortOrder
} from "./CovidTypes"

import {
    parseIntOrUndefined,
    getDoublingRange,
    accessors,
    inverseSortOrder,
    formatDate
} from "./CovidUtils"

import { CovidTableRow } from "./CovidTableRow"

export class CovidTableState {
    @observable.ref sortKey: CovidAccessorKey = "totalCases"
    @observable.ref sortOrder: SortOrder = SortOrder.desc
    @observable.ref isMobile: boolean = true
}

export interface CovidTableProps {
    preloadData?: CovidSeries
}

@observer
export class CovidTable extends React.Component<CovidTableProps> {
    @observable.ref data: CovidSeries | undefined =
        this.props.preloadData ?? undefined

    @observable.ref isLoaded: boolean = !!this.props.preloadData
    @observable.ref isLoading: boolean = false
    @observable.ref error: string | undefined = undefined

    @observable state = new CovidTableState()

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
        this.state.isMobile = window.innerWidth <= 680
    }

    async loadData() {
        this.isLoading = true
        try {
            const responseText = await fetchText(DATA_URL)
            const rows: CovidSeries = csvParse(responseText).map(row => {
                return {
                    date: new Date(row.date as string),
                    location: row.location as string,
                    total_cases: parseIntOrUndefined(row.total_cases),
                    total_deaths: parseIntOrUndefined(row.total_deaths),
                    new_cases: parseIntOrUndefined(row.new_cases),
                    new_deaths: parseIntOrUndefined(row.new_deaths)
                }
            })
            this.data = rows
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
                        caseDoublingRange: getDoublingRange(
                            sortedSeries,
                            d => d.total_cases
                        ),
                        deathDoublingRange: getDoublingRange(
                            sortedSeries,
                            d => d.total_deaths
                        )
                    }
                }
            )
        }
        return []
    }

    @computed get renderData() {
        const sortedSeries = orderBy(
            this.countrySeries,
            accessors[this.state.sortKey],
            this.state.sortOrder
        )
        const [shown, hidden] = partition(
            sortedSeries,
            d =>
                d.location.indexOf("International") === -1 &&
                (d.latest && d.latest.total_cases !== undefined
                    ? d.latest.total_cases >= CASE_THRESHOLD
                    : false)
        )
        return { shown, hidden }
    }

    @computed get dateRange(): DateRange {
        const difference = 13 // inclusive, so 14 days technically
        if (this.data !== undefined && this.data.length > 0) {
            const maxDate = max(this.data.map(d => d.date)) as Date
            const minDate = addDays(maxDate, -difference)
            return [minDate, maxDate]
        }
        return [addDays(new Date(), -difference), new Date()]
    }

    @computed get lastUpdated(): Date | undefined {
        return max(this.data?.map(d => d.date))
    }

    @action.bound onSort(newKey: CovidAccessorKey) {
        const { sortKey, sortOrder } = this.state
        this.state.sortOrder =
            sortKey === newKey && sortOrder === DEFAULT_SORT_ORDER
                ? inverseSortOrder(DEFAULT_SORT_ORDER)
                : DEFAULT_SORT_ORDER
        this.state.sortKey = newKey
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
                    "covid-table-mobile": this.state.isMobile
                })}
            >
                <table className="covid-table">
                    <thead>
                        <tr>
                            <HeaderCell
                                className="location"
                                sortKey="location"
                                currentSortKey={this.state.sortKey}
                                currentSortOrder={this.state.sortOrder}
                                onSort={this.onSort}
                            >
                                <strong>Location</strong>
                            </HeaderCell>
                            <HeaderCell
                                sortKey="daysToDoubleCases"
                                currentSortKey={this.state.sortKey}
                                currentSortOrder={this.state.sortOrder}
                                onSort={this.onSort}
                                colSpan={this.state.isMobile ? 2 : 1}
                            >
                                How long did it take for the number of{" "}
                                <strong>total confirmed cases to double</strong>
                                ?
                            </HeaderCell>
                            {!this.state.isMobile && (
                                <HeaderCell
                                    sortKey="totalCases"
                                    currentSortKey={this.state.sortKey}
                                    currentSortOrder={this.state.sortOrder}
                                    onSort={this.onSort}
                                >
                                    <strong>Total confirmed cases</strong>{" "}
                                    <br />
                                    <span className="note">
                                        WHO data.{" "}
                                        {this.lastUpdated !== undefined ? (
                                            <>
                                                Up to date for 10&nbsp;AM (CET)
                                                on{" "}
                                                {formatDate(this.lastUpdated)}.
                                            </>
                                        ) : (
                                            undefined
                                        )}
                                    </span>
                                </HeaderCell>
                            )}
                            {!this.state.isMobile && (
                                <HeaderCell
                                    sortKey="newCases"
                                    currentSortKey={this.state.sortKey}
                                    currentSortOrder={this.state.sortOrder}
                                    onSort={this.onSort}
                                >
                                    <strong>Daily new confirmed cases</strong>{" "}
                                    <br />
                                    <span className="note">
                                        WHO data.{" "}
                                        {this.lastUpdated !== undefined ? (
                                            <>
                                                Up to date for 10&nbsp;AM (CET)
                                                on{" "}
                                                {formatDate(this.lastUpdated)}.
                                            </>
                                        ) : (
                                            undefined
                                        )}
                                    </span>
                                </HeaderCell>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {this.renderData.shown.map(datum => (
                            <CovidTableRow
                                key={datum.id}
                                datum={datum}
                                dateRange={this.dateRange}
                                state={this.state}
                            />
                        ))}
                    </tbody>
                </table>
                <div className="covid-table-note">
                    <p className="tiny">
                        Countries with less than {CASE_THRESHOLD} confirmed
                        cases are not shown. Cases from the Diamond Princess
                        cruise ship are also not shown since these numbers are
                        no longer changing over time.
                    </p>
                    <p>
                        Data source:{" "}
                        <a href="https://www.who.int/emergencies/diseases/novel-coronavirus-2019/situation-reports/">
                            WHO
                        </a>
                        . Download the{" "}
                        <a href="https://ourworldindata.org/coronavirus-source-data">
                            full dataset
                        </a>
                        .
                    </p>
                </div>
            </div>
        )
    }
}
