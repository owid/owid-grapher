import * as React from "react"
import * as ReactDOM from "react-dom"
import { observer } from "mobx-react"
import { observable, computed, action } from "mobx"
import { csvParse, timeFormat, extent, scaleLinear } from "d3"
import { bind } from "decko"

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
    addDays
} from "charts/Util"

const DATA_URL = "https://cowid.netlify.com/data/full_data.csv"
const CASE_THRESHOLD = 10

// bar colors
const CURRENT_COLOR = "#1d3d63"
const HIGHLIGHT_COLOR = "#B04A00"
const DEFAULT_COLOR = "rgba(0, 33, 71, 0.25)"
const DEFAULT_FAINT_COLOR = "rgba(0, 33, 71, 0.09)"

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
    length: number | undefined
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
        if (halfDay !== undefined) {
            return {
                latestDay,
                halfDay,
                length: dateDiffInDays(latestDay.date, halfDay.date)
            }
        } else {
            return undefined
        }
    }
    return undefined
}

// each column has a specific accessor so we can identify which column the table is sorted by
// (it can also be none)
const accessors = {
    country_total_cases: (d: CovidCountryDatum) => d.latest?.total_cases,
    country_new_cases: (d: CovidCountryDatum) => d.latest?.new_cases
}

interface GlobalState {
    // when hovering over bars
    focusDay: Date
    sort: [string, "asc" | "desc"]
}

interface RowState {
    // when hovering over (?) we want to highlight the specific day in the chart that
    // the rate refers to
    // possibly can achieve this by having a component with colspan=2
    highlightTotalDay: Date
    highlightDailyDay: Date
}

class CovidTransformFactory {
    static promise: Promise<CovidTransform>
    static async fetch() {}
    static async get() {}
}

class CovidTransform {}

class CovidTableState {
    @observable.ref highlightDate: Date | undefined = undefined
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
    }

    async loadData() {
        this.isLoading = true
        try {
            const responseText = await fetchText(DATA_URL)
            const rows: CovidSeries = csvParse(responseText).map(row => {
                return {
                    date: new Date(row.date as string),
                    location: row.location as string,
                    total_cases: parseInt(row.total_cases as string),
                    total_deaths: parseInt(row.total_deaths as string),
                    new_cases: parseInt(row.new_cases as string),
                    new_deaths: parseInt(row.new_deaths as string)
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

    @computed get byLocation(): CovidCountrySeries {
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
        const [shown, hidden] = partition(
            this.byLocation,
            d =>
                d.location.indexOf("Diamond Princess") === -1 &&
                (d.latest && d.latest.total_cases !== undefined
                    ? d.latest.total_cases >= CASE_THRESHOLD
                    : false)
        )
        return {
            shown: sortBy(shown, d => d.latest?.total_cases).reverse(),
            hidden: sortBy(hidden, d => d.location)
        }
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

    @action.bound onHighlightDate(date: Date | undefined) {
        this.state.highlightDate = date
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
            <div className="covid-table-container">
                <table className="covid-table">
                    <thead>
                        <tr>
                            <th className="location">
                                <strong>Location</strong>
                            </th>
                            <th>
                                <strong>Total confirmed cases</strong> <br />
                                <span className="faint">
                                    over the last 14 days
                                </span>
                            </th>
                            <th>
                                How long did it take for the number of{" "}
                                <strong>confirmed cases to double</strong>?
                            </th>
                            <th>
                                <strong>Daily new confirmed cases</strong>{" "}
                                <br />
                                <span className="faint">
                                    over the last 14 days
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {this.renderData.shown.map(datum => (
                            <CovidTableRow
                                key={datum.id}
                                datum={datum}
                                dateRange={this.dateRange}
                                onHighlightDate={this.onHighlightDate}
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

function formatInt(n: number | undefined, defaultValue: string = ""): string {
    return n === undefined || isNaN(n) ? defaultValue : formatValue(n, {})
}

const defaultTimeFormat = timeFormat("%e %b")

function formatDate(
    date: Date | undefined,
    defaultValue: string = "",
    humanize: boolean = true
): string {
    if (date === undefined) return defaultValue
    if (humanize) {
        const diff = dateDiffInDays(new Date(), date)
        if (diff === 0) return "today"
        if (diff === 1) return "yesterday"
    }
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
    date
}: {
    value: string | undefined
    date: Date | undefined
}) => (
    <div className="time-series-value">
        {value !== undefined ? (
            <>
                <span className="count">{value}</span>
                <span className="date">{formatDate(date)}</span>
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

    @computed get hightlightedX(): number | undefined {
        const highlightDate =
            this.highlightDate || this.props.state.highlightDate
        if (highlightDate) {
            return this.dateToIndex(highlightDate)
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
        return (
            <tr>
                <td className="location">{d.location}</td>
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
                                        value={formatInt(d && d.total_cases)}
                                        date={d && d.date}
                                    />
                                )}
                                highlightedX={this.hightlightedX}
                                onHover={this.onBarHover}
                            />
                        </div>
                        <div className="value">
                            <TimeSeriesValue
                                value={formatInt(d.latest?.total_cases)}
                                date={d.latest?.date}
                            />
                        </div>
                    </div>
                </td>
                <td className="doubling-days large-value">
                    {d.caseDoublingRange !== undefined ? (
                        `${d.caseDoublingRange.length} ${nouns.days(
                            d.caseDoublingRange.length
                        )}`
                    ) : (
                        <span className="no-data">
                            Not enough data available yet
                        </span>
                    )}
                </td>
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
                                        value={formatInt(d && d.new_cases)}
                                        date={d && d.date}
                                    />
                                )}
                                highlightedX={this.hightlightedX}
                                onHover={this.onBarHover}
                            />
                        </div>
                        <div className="value">
                            <TimeSeriesValue
                                value={formatInt(d.latest?.new_cases)}
                                date={d.latest?.date}
                            />
                        </div>
                    </div>
                </td>
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
        let domain = extent(
            this.props.data
                .map(this.props.y)
                .filter(d => d !== undefined) as number[]
        )
        if (domain[0] === undefined) domain = [0, 1]
        return scaleLinear()
            .domain(domain)
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
        if (d === this.props.currentX) return CURRENT_COLOR
        if (d === this.props.highlightedX) return HIGHLIGHT_COLOR
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

export function runCovid() {
    const element = document.getElementById("covid-table-embed")
    if (element) {
        ReactDOM.render(<CovidTable />, element)
    }
}
