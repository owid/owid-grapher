import * as React from "react"
import { observable, computed } from "mobx"
import { observer } from "mobx-react"
import { bind } from "decko"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faQuestionCircle } from "@fortawesome/free-regular-svg-icons/faQuestionCircle"

import { dateDiffInDays, addDays } from "charts/Util"

import { CovidCountryDatum, DateRange, CovidDatum } from "./CovidTypes"
import { CovidDoublingTooltip } from "./CovidDoublingTooltip"
import { formatInt } from "./CovidUtils"
import { CovidTableState } from "./CovidTable"
import { Tippy } from "charts/Tippy"
import { nouns } from "./CovidConstants"
import { CovidBars } from "./CovidBars"
import { CovidTimeSeriesValue } from "./CovidTimeSeriesValue"

export interface CovidTableRowProps {
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
                                        <CovidDoublingTooltip
                                            caseDoublingRange={
                                                d.caseDoublingRange
                                            }
                                            noun={nouns.cases}
                                        />
                                    }
                                    maxWidth={260}
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
                                <CovidBars<CovidDatum>
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
                                <CovidBars<CovidDatum>
                                    data={this.data}
                                    xDomain={this.xDomain}
                                    x={this.x}
                                    y={d => d.total_cases}
                                    renderValue={d => (
                                        <CovidTimeSeriesValue
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
                                <CovidTimeSeriesValue
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
                                <CovidBars<CovidDatum>
                                    data={this.data}
                                    xDomain={this.xDomain}
                                    x={this.x}
                                    y={d => d.new_cases}
                                    renderValue={d => (
                                        <CovidTimeSeriesValue
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
                                <CovidTimeSeriesValue
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
