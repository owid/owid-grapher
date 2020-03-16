import * as React from "react"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons/faInfoCircle"

import { Tippy } from "charts/Tippy"

import {
    CovidTableHeaderCell as HeaderCell,
    CovidTableHeaderCellProps
} from "./CovidTableHeaderCell"
import { CovidSortKey, CovidCountryDatum, CovidDatum } from "./CovidTypes"
import { formatDate, formatInt } from "./CovidUtils"
import { CovidBarsProps, CovidBars } from "./CovidBars"
import { nouns } from "./CovidConstants"
import { CovidDoublingTooltip } from "./CovidDoublingTooltip"
import { CovidTimeSeriesValue } from "./CovidTimeSeriesValue"

export enum CovidTableColumnKey {
    location = "location",
    totalCases = "totalCases",
    newCases = "newCases",
    daysToDoubleCases = "daysToDoubleCases"
}

export type CovidTableHeaderSpec = Omit<
    CovidTableHeaderCellProps,
    "children" | "sortKey"
> & {
    isMobile: boolean
    lastUpdated: Date | undefined
}

export interface CovidTableCellSpec {
    datum: CovidCountryDatum
    isMobile: boolean
    bars: Pick<
        CovidBarsProps<CovidDatum>,
        "data" | "xDomain" | "x" | "currentX" | "highlightedX" | "onHover"
    >
}

export interface CovidTableColumnSpec {
    sortKey: CovidSortKey
    header: (props: CovidTableHeaderSpec) => JSX.Element
    cell: (props: CovidTableCellSpec) => JSX.Element
}

// TODO
// There can be columns you cannot sort by, therefore don't have accessors (accessors return undefined is best to implement)
// There can be sorting that doesn't have a column

export const columns: Record<CovidTableColumnKey, CovidTableColumnSpec> = {
    location: {
        sortKey: CovidSortKey.location,
        header: props => (
            <HeaderCell
                {...props}
                className="location"
                sortKey={CovidSortKey.location}
            >
                <strong>Location</strong>
            </HeaderCell>
        ),
        cell: props => <td className="location">{props.datum.location}</td>
    },
    daysToDoubleCases: {
        sortKey: CovidSortKey.daysToDoubleCases,
        header: props => (
            <HeaderCell
                {...props}
                sortKey={CovidSortKey.daysToDoubleCases}
                colSpan={props.isMobile ? 2 : 1}
            >
                How long did it take for the number of{" "}
                <strong>total confirmed cases to double</strong>?
            </HeaderCell>
        ),
        cell: props => {
            const { datum, bars, isMobile } = props
            const { caseDoublingRange } = datum
            return (
                <React.Fragment>
                    <td className="doubling-days">
                        {caseDoublingRange !== undefined ? (
                            <>
                                <span className="label">doubled in</span> <br />
                                <span className="days">
                                    {caseDoublingRange.length}
                                    &nbsp;
                                    {nouns.days(caseDoublingRange.length)}&nbsp;
                                    <Tippy
                                        content={
                                            <CovidDoublingTooltip
                                                caseDoublingRange={
                                                    caseDoublingRange
                                                }
                                                noun={nouns.cases}
                                            />
                                        }
                                        maxWidth={260}
                                    >
                                        <span className="info-icon">
                                            <FontAwesomeIcon
                                                icon={faInfoCircle}
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
                    {isMobile && (
                        <td className="plot-cell">
                            <div className="trend">
                                <div className="plot">
                                    <CovidBars<CovidDatum>
                                        {...bars}
                                        y={d => d.total_cases}
                                    />
                                </div>
                            </div>
                        </td>
                    )}
                </React.Fragment>
            )
        }
    },
    totalCases: {
        sortKey: CovidSortKey.totalCases,
        header: props => (
            <HeaderCell {...props} sortKey={CovidSortKey.totalCases}>
                <strong>Total confirmed cases</strong> <br />
                <span className="note">
                    WHO data.{" "}
                    {props.lastUpdated !== undefined ? (
                        <>
                            Up to date for 10&nbsp;AM (CET) on{" "}
                            {formatDate(props.lastUpdated)}.
                        </>
                    ) : (
                        undefined
                    )}
                </span>
            </HeaderCell>
        ),
        cell: props => {
            const { bars, datum } = props
            return (
                <td className="total-cases plot-cell">
                    <div className="trend">
                        <div className="plot">
                            <CovidBars<CovidDatum>
                                {...bars}
                                y={d => d.total_cases}
                                renderValue={d => (
                                    <CovidTimeSeriesValue
                                        value={formatInt(d && d.total_cases)}
                                        date={d && d.date}
                                    />
                                )}
                            />
                        </div>
                        <div className="value">
                            <CovidTimeSeriesValue
                                value={`${formatInt(
                                    datum.latest?.total_cases
                                )} total`}
                                date={datum.latest?.date}
                                latest={true}
                            />
                        </div>
                    </div>
                </td>
            )
        }
    },
    newCases: {
        sortKey: CovidSortKey.newCases,
        header: props => (
            <HeaderCell {...props} sortKey={CovidSortKey.newCases}>
                <strong>Daily new confirmed cases</strong> <br />
                <span className="note">
                    WHO data.{" "}
                    {props.lastUpdated !== undefined ? (
                        <>
                            Up to date for 10&nbsp;AM (CET) on{" "}
                            {formatDate(props.lastUpdated)}.
                        </>
                    ) : (
                        undefined
                    )}
                </span>
            </HeaderCell>
        ),
        cell: props => {
            const { bars, datum } = props
            return (
                <td className="new-cases plot-cell">
                    <div className="trend">
                        <div className="plot">
                            <CovidBars<CovidDatum>
                                {...bars}
                                y={d => d.new_cases}
                                renderValue={d => (
                                    <CovidTimeSeriesValue
                                        value={formatInt(d && d.new_cases, "", {
                                            showPlus: true
                                        })}
                                        date={d && d.date}
                                    />
                                )}
                            />
                        </div>
                        <div className="value">
                            <CovidTimeSeriesValue
                                value={`${formatInt(
                                    datum.latest?.new_cases,
                                    "",
                                    {
                                        showPlus: true
                                    }
                                )} new`}
                                date={datum.latest?.date}
                                latest={true}
                            />
                        </div>
                    </div>
                </td>
            )
        }
    }
}
