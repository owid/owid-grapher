import * as React from "react"
import * as ReactDOM from "react-dom"
import { observer } from "mobx-react"
import { observable, computed, action } from "mobx"
import { csvParse, utcFormat, scaleLinear } from "d3"
import { bind } from "decko"
import classnames from "classnames"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faQuestionCircle } from "@fortawesome/free-regular-svg-icons/faQuestionCircle"

import { TickFormattingOptions } from "charts/TickFormattingOptions"
import { Tippy } from "charts/Tippy"

import {
    fetchText,
    sortBy,
    maxBy,
    groupBy,
    entries,
    partition,
    formatValue,
    max,
    keyBy,
    dateDiffInDays,
    addDays,
    orderBy,
    defaultTo,
    throttle
} from "charts/Util"

const DATA_URL = "https://covid.ourworldindata.org/data/full_data.csv"
const CASE_THRESHOLD = 10

// bar colors
const CURRENT_COLOR = "#1d3d63"
const HIGHLIGHT_COLOR = "#d42b21"
const DEFAULT_COLOR = "rgba(0, 33, 71, 0.25)"
const DEFAULT_FAINT_COLOR = "rgba(0, 33, 71, 0.25)"

interface CovidDatum {
    date: Date
    location: string
    total_cases: number | undefined
    total_deaths: number | undefined
    new_cases: number | undefined
    new_deaths: number | undefined
}

type CovidSeries = CovidDatum[]

interface CovidCountryDatum {
    id: string
    location: string
    series: CovidSeries
    latest: CovidDatum | undefined
    caseDoublingRange: CovidDoublingRange | undefined
}

type CovidCountrySeries = CovidCountryDatum[]

interface CovidDoublingRange {
    latestDay: CovidDatum
    halfDay: CovidDatum
    length: number
    ratio: number
}

interface CovidTableProps {
    preloadData?: CovidSeries
}

type DateRange = [Date, Date]

function getDoublingRange(
    series: CovidSeries,
    accessor: (d: CovidDatum) => number | undefined
): CovidDoublingRange | undefined {
    if (series.length > 1) {
        const latestDay = maxBy(series, d => d.date) as CovidDatum
        const latestValue = accessor(latestDay)
        if (latestValue === undefined) return undefined
        const filteredSeries = series.filter(d => {
            const value = accessor(d)
            return value && value <= latestValue / 2
        })
        const halfDay = maxBy(filteredSeries, d => d.date)
        if (halfDay === undefined) return undefined
        const halfValue = accessor(halfDay)
        if (halfValue === undefined) return undefined
        return {
            latestDay,
            halfDay,
            length: dateDiffInDays(latestDay.date, halfDay.date),
            ratio: latestValue / halfValue
        }
    }
    return undefined
}

type AccessorKey = "location" | "totalCases" | "newCases" | "daysToDouble"

const accessors: Record<AccessorKey, any> = {
    location: (d: CovidCountryDatum) => d.location,
    totalCases: (d: CovidCountryDatum) => d.latest?.total_cases,
    newCases: (d: CovidCountryDatum) => d.latest?.new_cases,
    daysToDouble: (d: CovidCountryDatum) => d.caseDoublingRange?.length
}

enum SortOrder {
    asc = "asc",
    desc = "desc"
}

const DEFAULT_SORT_ORDER = SortOrder.asc

function inverseSortOrder(order: SortOrder): SortOrder {
    return order === SortOrder.asc ? SortOrder.desc : SortOrder.asc
}

class CovidTableState {
    @observable.ref sortKey: AccessorKey = "totalCases"
    @observable.ref sortOrder: SortOrder = SortOrder.desc
    @observable.ref isMobile: boolean = true
}

interface HeaderCellProps {
    children: React.ReactNode
    className?: string
    sortKey?: AccessorKey
    currentSortKey?: AccessorKey
    currentSortOrder?: SortOrder
    isSorted?: boolean
    colSpan?: number
    onSort?: (key: AccessorKey) => void
}

class HeaderCell extends React.Component<HeaderCellProps> {
    @bind onClick() {
        if (this.props.sortKey && this.props.onSort) {
            this.props.onSort(this.props.sortKey)
        }
    }

    render() {
        const {
            className,
            sortKey,
            currentSortKey,
            currentSortOrder,
            children,
            colSpan
        } = this.props
        const isSorted = sortKey !== undefined && sortKey === currentSortKey
        return (
            <th
                className={classnames(className, {
                    sortable: sortKey,
                    sorted: isSorted
                })}
                onClick={this.onClick}
                colSpan={colSpan}
            >
                {children}
                {sortKey !== undefined && (
                    <SortIcon
                        sortOrder={
                            isSorted && currentSortOrder
                                ? currentSortOrder
                                : DEFAULT_SORT_ORDER
                        }
                        isActive={isSorted}
                    />
                )}
            </th>
        )
    }
}

interface SortIconProps {
    sortOrder: SortOrder
    isActive: boolean
}

const SortIcon = (props: SortIconProps) => {
    const isActive = defaultTo(props.isActive, false)

    return (
        <span
            className={classnames("sort-icon", props.sortOrder, {
                active: isActive
            })}
        />
    )
}

function parseIntOrUndefined(s: string | undefined) {
    if (s === undefined) return undefined
    const value = parseInt(s)
    return isNaN(value) ? undefined : value
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

    @action.bound onSort(newKey: AccessorKey) {
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
                                sortKey="daysToDouble"
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

function formatInt(
    n: number | undefined,
    defaultValue: string = "",
    options: TickFormattingOptions = {}
): string {
    return n === undefined || isNaN(n) ? defaultValue : formatValue(n, options)
}

const defaultTimeFormat = utcFormat("%B %e")

function formatDate(date: Date | undefined, defaultValue: string = ""): string {
    if (date === undefined) return defaultValue
    return defaultTimeFormat(date)
}

function pluralify(singular: string, plural: string) {
    return (num: number | undefined) => {
        if (num === undefined) return ""
        if (num === 1) return singular
        return plural
    }
}

const nouns = {
    cases: pluralify("case", "cases"),
    days: pluralify("day", "days")
}

const TimeSeriesValue = ({
    value,
    date,
    latest
}: {
    value: string | undefined
    date: Date | undefined
    latest?: boolean
}) => (
    <div className="time-series-value">
        {value !== undefined ? (
            <>
                <span className="count">{value}</span>
                <span className={classnames("date", { latest: latest })}>
                    {formatDate(date)}
                </span>
            </>
        ) : (
            undefined
        )}
    </div>
)

interface CovidTableRowProps {
    datum: CovidCountryDatum
    dateRange: DateRange
    state: CovidTableState
    onHighlightDate: (date: Date | undefined) => void
}

@observer
export class CovidTableRow extends React.Component<CovidTableRowProps> {
    static defaultProps = {
        onHighlightDate: () => undefined
    }

    @observable.ref highlightDate: Date | undefined = undefined

    @computed get data() {
        const d = this.props.datum
        const [start, end] = this.props.dateRange
        return d.series.filter(d => d.date >= start && d.date <= end)
    }

    @bind dateToIndex(date: Date): number {
        return dateDiffInDays(date, this.props.dateRange[0])
    }

    @bind dateFromIndex(index: number): Date {
        return addDays(this.props.dateRange[0], index)
    }

    @computed get xDomain(): [number, number] {
        const [start, end] = this.props.dateRange
        return [0, dateDiffInDays(end, start)]
    }

    @computed get currentX(): number | undefined {
        const { datum } = this.props
        if (datum.latest) {
            return this.dateToIndex(datum.latest.date)
        }
        return undefined
    }

    @computed get hightlightedX(): number | undefined {
        const { datum, state } = this.props
        if (state.isMobile && datum.caseDoublingRange) {
            return this.dateToIndex(datum.caseDoublingRange.halfDay.date)
        }
        if (this.highlightDate) {
            return this.dateToIndex(this.highlightDate)
        }
        return undefined
    }

    @bind x(d: CovidDatum): number {
        return this.dateToIndex(d.date)
    }

    @bind onBarHover(d: CovidDatum | undefined, i: number | undefined) {
        let date
        if (d !== undefined) {
            date = d.date
        } else if (i !== undefined) {
            date = this.dateFromIndex(i)
        } else {
            date = undefined
        }
        this.highlightDate = date
    }

    render() {
        const d = this.props.datum
        const state = this.props.state
        return (
            <tr>
                <td className="location">{d.location}</td>
                <td className="doubling-days">
                    {d.caseDoublingRange !== undefined ? (
                        <>
                            <span className="label">doubled in</span> <br />
                            <span className="days">
                                {d.caseDoublingRange.length}
                                &nbsp;
                                {nouns.days(d.caseDoublingRange.length)}&nbsp;
                                <Tippy
                                    content={
                                        <DoublingInfoTooltip
                                            caseDoublingRange={
                                                d.caseDoublingRange
                                            }
                                        />
                                    }
                                    maxWidth={270}
                                >
                                    <span className="info-icon">
                                        <FontAwesomeIcon
                                            icon={faQuestionCircle}
                                        />
                                    </span>
                                </Tippy>
                            </span>
                        </>
                    ) : (
                        <span className="no-data">
                            Not enough data available
                        </span>
                    )}
                </td>
                {state.isMobile && (
                    <td className="plot-cell">
                        <div className="trend">
                            <div className="plot">
                                <Bars<CovidDatum>
                                    data={this.data}
                                    xDomain={this.xDomain}
                                    x={this.x}
                                    y={d => d.total_cases}
                                    currentX={this.currentX}
                                    highlightedX={this.hightlightedX}
                                    onHover={this.onBarHover}
                                />
                            </div>
                        </div>
                    </td>
                )}
                {!state.isMobile && (
                    <td className="total-cases plot-cell">
                        <div className="trend">
                            <div className="plot">
                                <Bars<CovidDatum>
                                    data={this.data}
                                    xDomain={this.xDomain}
                                    x={this.x}
                                    y={d => d.total_cases}
                                    renderValue={d => (
                                        <TimeSeriesValue
                                            value={formatInt(
                                                d && d.total_cases
                                            )}
                                            date={d && d.date}
                                        />
                                    )}
                                    currentX={this.currentX}
                                    highlightedX={this.hightlightedX}
                                    onHover={this.onBarHover}
                                />
                            </div>
                            <div className="value">
                                <TimeSeriesValue
                                    value={`${formatInt(
                                        d.latest?.total_cases
                                    )} total`}
                                    date={d.latest?.date}
                                    latest={true}
                                />
                            </div>
                        </div>
                    </td>
                )}
                {!state.isMobile && (
                    <td className="new-cases plot-cell">
                        <div className="trend">
                            <div className="plot">
                                <Bars<CovidDatum>
                                    data={this.data}
                                    xDomain={this.xDomain}
                                    x={this.x}
                                    y={d => d.new_cases}
                                    renderValue={d => (
                                        <TimeSeriesValue
                                            value={formatInt(
                                                d && d.new_cases,
                                                "",
                                                { showPlus: true }
                                            )}
                                            date={d && d.date}
                                        />
                                    )}
                                    currentX={this.currentX}
                                    highlightedX={this.hightlightedX}
                                    onHover={this.onBarHover}
                                />
                            </div>
                            <div className="value">
                                <TimeSeriesValue
                                    value={`${formatInt(
                                        d.latest?.new_cases,
                                        "",
                                        { showPlus: true }
                                    )} new`}
                                    date={d.latest?.date}
                                    latest={true}
                                />
                            </div>
                        </div>
                    </td>
                )}
            </tr>
        )
    }
}

interface BarsProps<T> {
    data: T[]
    x: (d: T) => number
    y: (d: T) => number | undefined
    xDomain: [number, number]
    onHover: (d: T | undefined, index: number | undefined) => void
    currentX?: number
    highlightedX?: number
    renderValue?: (d: T | undefined) => JSX.Element
}

@observer
export class Bars<T> extends React.Component<BarsProps<T>> {
    static defaultProps = {
        onHover: () => undefined
    }

    @computed get barHeightScale() {
        const maxY = max(
            this.props.data
                .map(this.props.y)
                .filter(d => d !== undefined) as number[]
        )
        return scaleLinear()
            .domain([0, maxY !== undefined ? maxY : 1])
            .range([0, 1])
    }

    @bind barHeight(d: T | undefined) {
        if (d !== undefined) {
            const value = this.props.y(d)
            if (value !== undefined) {
                const ratio = this.barHeightScale(value)
                return `${ratio * 100}%`
            }
        }
        return "0%"
    }

    @bind barColor(d: number) {
        if (d === this.props.highlightedX) return HIGHLIGHT_COLOR
        if (d === this.props.currentX) return CURRENT_COLOR
        if (this.props.highlightedX !== undefined) return DEFAULT_FAINT_COLOR
        return DEFAULT_COLOR
    }

    @computed get bars(): (T | undefined)[] {
        const indexed = keyBy(this.props.data, this.props.x)
        const [start, end] = this.props.xDomain
        const result = []
        for (let i = start; i <= end; i++) {
            result.push(indexed[i])
        }
        return result
    }

    render() {
        return (
            <div
                className="covid-bars"
                onMouseLeave={() => this.props.onHover(undefined, undefined)}
            >
                {this.bars.map((d, i) => (
                    <div
                        key={i}
                        className="bar-wrapper"
                        onMouseEnter={() => this.props.onHover(d, i)}
                    >
                        {this.props.highlightedX === i &&
                            d !== undefined &&
                            this.props.renderValue && (
                                <div
                                    className="hanging-value"
                                    style={{ color: HIGHLIGHT_COLOR }}
                                >
                                    {this.props.renderValue(d)}
                                </div>
                            )}
                        <div
                            className="bar"
                            style={{
                                height: this.barHeight(d),
                                backgroundColor: this.barColor(i)
                            }}
                        ></div>
                    </div>
                ))}
            </div>
        )
    }
}

export const DoublingInfoTooltip = (props: {
    caseDoublingRange: CovidDoublingRange
}) => {
    const { latestDay, halfDay, ratio, length } = props.caseDoublingRange
    return (
        <div className="covid-tooltip">
            The total confirmed cases in {latestDay.location} have increased by{" "}
            <span className="growth-rate">{ratio.toFixed(1)}x</span> in the{" "}
            <span className="period">last {length} days</span>.
            <table className="values">
                <tr>
                    <td className="value from-color">
                        {formatInt(halfDay.total_cases)}{" "}
                        {nouns.cases(halfDay.total_cases)}
                    </td>
                    <td>on</td>
                    <td className="date from-color">
                        {formatDate(halfDay.date)}
                    </td>
                </tr>
                <tr>
                    <td className="value to-color">
                        {formatInt(latestDay.total_cases)}{" "}
                        {nouns.cases(latestDay.total_cases)}
                    </td>
                    <td>on</td>
                    <td className="date to-color">
                        {formatDate(latestDay.date)}
                    </td>
                </tr>
            </table>
        </div>
    )
}

export function runCovid() {
    const element = document.getElementById("covid-table-embed")
    if (element) {
        ReactDOM.render(<CovidTable />, element)
    }
}
