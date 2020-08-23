import * as React from "react"
import { scaleThreshold, scaleLinear, ScaleLinear } from "d3-scale"
import { interpolateLab } from "d3-interpolate"
import classnames from "classnames"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons/faInfoCircle"
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons/faExclamationCircle"
import { faCheckCircle } from "@fortawesome/free-regular-svg-icons/faCheckCircle"

import { Tippy } from "charts/core/Tippy"

import {
    CovidTableHeaderCell as HeaderCell,
    CovidTableHeaderCellProps
} from "./CovidTableHeaderCell"
import {
    CovidSortKey,
    CovidCountryDatum,
    CovidDatum,
    NounGenerator,
    CovidDoublingRange
} from "./CovidTypes"
import { formatDate, formatInt } from "./CovidUtils"
import { nouns } from "./CovidConstants"
import { CovidDoublingTooltip } from "./CovidDoublingTooltip"
import { CovidTimeSeriesValue } from "./CovidTimeSeriesValue"
import { SparkBars, SparkBarsProps } from "charts/sparkBars/SparkBars"

export enum CovidTableColumnKey {
    location = "location",
    locationTests = "locationTests",
    totalCases = "totalCases",
    newCases = "newCases",
    totalDeaths = "totalDeaths",
    newDeaths = "newDeaths",
    daysToDoubleCases = "daysToDoubleCases",
    daysToDoubleDeaths = "daysToDoubleDeaths",
    totalTests = "totalTests",
    testDate = "testDate",
    testSource = "testSource"
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
        SparkBarsProps<CovidDatum>,
        "data" | "xDomain" | "x" | "currentX" | "highlightedX" | "onHover"
    >
    totalTestsBarScale: ScaleLinear<number, number>
    countryColors: Record<string, string>
    baseRowSpan: number
}

export interface CovidTableColumnSpec {
    sortKey?: CovidSortKey
    header: (props: CovidTableHeaderSpec) => JSX.Element
    cell: (props: CovidTableCellSpec) => JSX.Element
}

type IntAccessor = (d: CovidDatum) => number | undefined
type RangeAccessor = (d: CovidCountryDatum) => CovidDoublingRange | undefined

// Deaths color scales

const deathsDoubingTextColorScale = scaleThreshold<number, string>()
    .domain([12])
    .range(["white", "rgba(0,0,0,0.5)"])

const deathsDoubingBackgColorScale = scaleLinear<string>()
    .domain([1, 3, 13])
    .range(["#8a0000", "#bf0000", "#eee"])
    .interpolate(interpolateLab)
    .clamp(true)

// Cases color scales

const casesDoubingTextColorScale = scaleThreshold<number, string>()
    .domain([12])
    .range(["white", "rgba(0,0,0,0.5)"])

const casesDoubingBackgColorScale = scaleLinear<string>()
    .domain([1, 3, 13])
    .range(["#b11c5b", "#CA3A77", "#eee"])
    .interpolate(interpolateLab)
    .clamp(true)

const daysToDoubleGenerator = (
    accessorDatum: IntAccessor,
    accessorRange: RangeAccessor,
    noun: NounGenerator,
    doubingBackgColorScale: (n: number) => string,
    doubingTextColorScale: (n: number) => string
) => (props: CovidTableCellSpec) => {
    const { datum, bars, isMobile } = props
    const range = accessorRange(datum)
    return (
        <React.Fragment>
            <td className="doubling-days" rowSpan={props.baseRowSpan}>
                {range !== undefined ? (
                    <>
                        <span>
                            <span className="label">doubled in</span> <br />
                            <span
                                className="days"
                                style={{
                                    backgroundColor: doubingBackgColorScale(
                                        range.length
                                    ),
                                    color: doubingTextColorScale(range.length)
                                }}
                            >
                                {range.length}
                                &nbsp;
                                {nouns.days(range.length)}&nbsp;
                                <Tippy
                                    content={
                                        <CovidDoublingTooltip
                                            doublingRange={range}
                                            noun={noun}
                                            accessor={accessorDatum}
                                        />
                                    }
                                    maxWidth={260}
                                >
                                    <span className="info-icon">
                                        <FontAwesomeIcon icon={faInfoCircle} />
                                    </span>
                                </Tippy>
                            </span>
                        </span>
                    </>
                ) : (
                    <span className="no-data">Not enough data available</span>
                )}
            </td>
            {isMobile && (
                <td
                    className={`plot-cell measure--${noun()}`}
                    rowSpan={props.baseRowSpan}
                >
                    <div className="trend">
                        <div className="plot">
                            <SparkBars<CovidDatum>
                                className="spark-bars covid-bars"
                                {...bars}
                                y={accessorDatum}
                                highlightedX={
                                    range !== undefined
                                        ? bars.x(range.halfDay)
                                        : undefined
                                }
                            />
                        </div>
                    </div>
                </td>
            )}
        </React.Fragment>
    )
}

const totalGenerator = (accessor: IntAccessor, noun: NounGenerator) => (
    props: CovidTableCellSpec
) => {
    const { bars, datum } = props
    return (
        <td
            className={`plot-cell measure--${noun()}`}
            rowSpan={props.baseRowSpan}
        >
            <div className="trend">
                <div className="plot">
                    <SparkBars<CovidDatum>
                        className="spark-bars covid-bars"
                        {...bars}
                        y={accessor}
                        renderValue={d =>
                            d && accessor(d) !== undefined ? (
                                <CovidTimeSeriesValue
                                    className="highlighted"
                                    value={formatInt(accessor(d))}
                                    date={d.date}
                                />
                            ) : undefined
                        }
                    />
                </div>
                <div className="value">
                    {datum.latest && accessor(datum.latest) !== undefined && (
                        <CovidTimeSeriesValue
                            className="current"
                            value={`${formatInt(accessor(datum.latest))} total`}
                            date={datum.latest.date}
                            latest={true}
                        />
                    )}
                </div>
            </div>
        </td>
    )
}

const newGenerator = (accessor: IntAccessor, noun: NounGenerator) => (
    props: CovidTableCellSpec
) => {
    const { bars, datum } = props
    return (
        <td
            className={`plot-cell measure--${noun()}`}
            rowSpan={props.baseRowSpan}
        >
            <div className="trend">
                <div className="plot">
                    <SparkBars<CovidDatum>
                        className="spark-bars covid-bars"
                        {...bars}
                        y={accessor}
                        renderValue={d =>
                            d && accessor(d) !== undefined ? (
                                <CovidTimeSeriesValue
                                    className="highlighted"
                                    value={formatInt(accessor(d), "", {
                                        showPlus: true
                                    })}
                                    date={d && d.date}
                                />
                            ) : undefined
                        }
                    />
                </div>
                <div className="value">
                    {datum.latest && accessor(datum.latest) !== undefined && (
                        <CovidTimeSeriesValue
                            className="current"
                            value={`${formatInt(accessor(datum.latest), "", {
                                showPlus: true
                            })} new`}
                            date={datum.latest.date}
                            latest={true}
                        />
                    )}
                </div>
            </div>
        </td>
    )
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
        cell: props => (
            <td className="location" rowSpan={props.baseRowSpan}>
                {props.datum.location}
            </td>
        )
    },
    locationTests: {
        sortKey: CovidSortKey.location,
        header: props => (
            <HeaderCell
                {...props}
                className="location-tests"
                sortKey={CovidSortKey.location}
            >
                <strong>Location</strong>
            </HeaderCell>
        ),
        cell: props => (
            <td className="location-tests" rowSpan={props.baseRowSpan}>
                {props.datum.location}
            </td>
        )
    },
    daysToDoubleCases: {
        sortKey: CovidSortKey.daysToDoubleCases,
        header: props => (
            <HeaderCell
                {...props}
                className={`measure--${nouns.cases()}`}
                sortKey={CovidSortKey.daysToDoubleCases}
                colSpan={props.isMobile ? 2 : 1}
            >
                How long did it take for the number of{" "}
                <strong>
                    total confirmed <span className="measure">cases</span> to
                    double
                </strong>
                ?
            </HeaderCell>
        ),
        cell: daysToDoubleGenerator(
            d => d.totalCases,
            d => d.caseDoublingRange,
            nouns.cases,
            casesDoubingBackgColorScale,
            casesDoubingTextColorScale
        )
    },
    daysToDoubleDeaths: {
        sortKey: CovidSortKey.daysToDoubleDeaths,
        header: props => (
            <HeaderCell
                {...props}
                className={`measure--${nouns.deaths()}`}
                sortKey={CovidSortKey.daysToDoubleDeaths}
                colSpan={props.isMobile ? 2 : 1}
            >
                How long did it take for the number of{" "}
                <strong>
                    total confirmed <span className="measure">deaths</span> to
                    double
                </strong>
                ?
            </HeaderCell>
        ),
        cell: daysToDoubleGenerator(
            d => d.totalDeaths,
            d => d.deathDoublingRange,
            nouns.deaths,
            deathsDoubingBackgColorScale,
            deathsDoubingTextColorScale
        )
    },
    totalCases: {
        sortKey: CovidSortKey.totalCases,
        header: props => (
            <HeaderCell
                {...props}
                className={`measure--${nouns.cases()}`}
                sortKey={CovidSortKey.totalCases}
            >
                <strong>
                    Total confirmed <span className="measure">cases</span>
                </strong>{" "}
                <br />
                <span className="note">
                    ECDC data.{" "}
                    {props.lastUpdated !== undefined ? (
                        <>
                            Up to date for 10&nbsp;AM (CET) on{" "}
                            {formatDate(props.lastUpdated)}.
                        </>
                    ) : undefined}
                </span>
            </HeaderCell>
        ),
        cell: totalGenerator(d => d.totalCases, nouns.cases)
    },
    totalDeaths: {
        sortKey: CovidSortKey.totalDeaths,
        header: props => (
            <HeaderCell
                {...props}
                className={`measure--${nouns.deaths()}`}
                sortKey={CovidSortKey.totalDeaths}
            >
                <strong>
                    Total confirmed <span className="measure">deaths</span>
                </strong>{" "}
                <br />
                <span className="note">
                    ECDC data.{" "}
                    {props.lastUpdated !== undefined ? (
                        <>
                            Up to date for 10&nbsp;AM (CET) on{" "}
                            {formatDate(props.lastUpdated)}.
                        </>
                    ) : undefined}
                </span>
            </HeaderCell>
        ),
        cell: totalGenerator(d => d.totalDeaths, nouns.deaths)
    },
    newCases: {
        sortKey: CovidSortKey.newCases,
        header: props => (
            <HeaderCell
                {...props}
                className={`measure--${nouns.cases()}`}
                sortKey={CovidSortKey.newCases}
            >
                <strong>
                    Daily new confirmed <span className="measure">cases</span>
                </strong>{" "}
                <br />
                <span className="note">
                    ECDC data.{" "}
                    {props.lastUpdated !== undefined ? (
                        <>
                            Up to date for 10&nbsp;AM (CET) on{" "}
                            {formatDate(props.lastUpdated)}.
                        </>
                    ) : undefined}
                </span>
            </HeaderCell>
        ),
        cell: newGenerator(d => d.newCases, nouns.cases)
    },
    newDeaths: {
        sortKey: CovidSortKey.newDeaths,
        header: props => (
            <HeaderCell
                {...props}
                className={`measure--${nouns.deaths()}`}
                sortKey={CovidSortKey.newDeaths}
            >
                <strong>
                    Daily new confirmed <span className="measure">deaths</span>
                </strong>{" "}
                <br />
                <span className="note">
                    ECDC data.{" "}
                    {props.lastUpdated !== undefined ? (
                        <>
                            Up to date for 10&nbsp;AM (CET) on{" "}
                            {formatDate(props.lastUpdated)}.
                        </>
                    ) : undefined}
                </span>
            </HeaderCell>
        ),
        cell: newGenerator(d => d.newDeaths, nouns.deaths)
    },
    totalTests: {
        sortKey: CovidSortKey.totalTests,
        header: props => (
            <HeaderCell
                {...props}
                className={`measure--${nouns.tests()}`}
                sortKey={CovidSortKey.totalTests}
                colSpan={2}
            >
                <strong>
                    Total <span className="measure">tests</span>
                </strong>
            </HeaderCell>
        ),
        cell: props => (
            <React.Fragment>
                <td
                    className={`measure--${nouns.tests()} total-tests`}
                    rowSpan={1}
                >
                    {formatInt(
                        props.datum.latestWithTests?.tests?.totalTests,
                        ""
                    )}
                </td>
                <td
                    className={`measure--${nouns.tests()} total-tests-bar`}
                    rowSpan={1}
                >
                    {props.datum.latestWithTests?.tests?.totalTests !==
                        undefined && (
                        <div
                            className="bar"
                            style={{
                                backgroundColor:
                                    props.countryColors[props.datum.location],
                                width: `${
                                    props.totalTestsBarScale(
                                        props.datum.latestWithTests.tests
                                            .totalTests
                                    ) * 100
                                }%`
                            }}
                        />
                    )}
                </td>
            </React.Fragment>
        )
    },
    testDate: {
        sortKey: CovidSortKey.testDate,
        header: props => (
            <HeaderCell
                {...props}
                className={`measure--${nouns.tests()}`}
                sortKey={CovidSortKey.testDate}
            >
                <strong>Date</strong>
            </HeaderCell>
        ),
        cell: props => (
            <td className="date" rowSpan={1}>
                {formatDate(props.datum.latestWithTests?.date, "")}
            </td>
        )
    },
    testSource: {
        header: props => (
            <HeaderCell {...props} className={`measure--${nouns.tests()}`}>
                <strong>Source</strong>
            </HeaderCell>
        ),
        cell: props => {
            if (props.datum.latestWithTests?.tests === undefined)
                return <td></td>

            const { date, tests } = props.datum.latestWithTests
            const {
                sourceURL,
                sourceLabel,
                publicationDate,
                remarks,
                nonOfficial
            } = tests
            return (
                <td className="testing-notes">
                    <span
                        className={classnames("official", {
                            "is-official": !nonOfficial
                        })}
                    >
                        <Tippy
                            content={
                                <div className="covid-tooltip">
                                    <a href={sourceURL}>{sourceLabel}</a>
                                    <br />
                                    Refers to: {formatDate(date)}
                                    <br />
                                    Published: {formatDate(publicationDate)}
                                    <br />
                                    Remarks: {remarks}
                                </div>
                            }
                        >
                            <span>
                                {nonOfficial ? (
                                    <FontAwesomeIcon
                                        icon={faExclamationCircle}
                                    />
                                ) : (
                                    <FontAwesomeIcon icon={faCheckCircle} />
                                )}
                            </span>
                        </Tippy>
                    </span>
                </td>
            )
        }
    }
}
