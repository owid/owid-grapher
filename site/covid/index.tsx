import React from "react"
import ReactDOM from "react-dom"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCheckCircle } from "@fortawesome/free-regular-svg-icons/faCheckCircle"
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons/faExclamationCircle"
import { CovidTable, CovidTableProps } from "./CovidTable.js"
import { CovidTableColumnKey } from "./CovidTableColumns.js"
import { CovidSortKey } from "./CovidTypes.js"
import { fetchTestsData, fetchJHUData } from "./CovidFetch.js"
import { formatDate } from "./CovidUtils.js"
import { Tippy } from "../../grapher/chart/Tippy.js"
import { SortOrder } from "@ourworldindata/core-table"
import { oneOf } from "@ourworldindata/utils"

type Measure = "cases" | "deaths" | "tests" | "deathsAndCases"

const CASE_THRESHOLD = 20
const DEATH_THRESHOLD = 5

const propsByMeasure: Record<Measure, Partial<CovidTableProps>> = {
    cases: {
        loadData: fetchJHUData,
        columns: [
            CovidTableColumnKey.location,
            CovidTableColumnKey.daysToDoubleCases,
            CovidTableColumnKey.totalCases,
            CovidTableColumnKey.newCases,
        ],
        mobileColumns: [
            CovidTableColumnKey.location,
            CovidTableColumnKey.daysToDoubleCases,
        ],
        defaultState: {
            sortKey: CovidSortKey.daysToDoubleCases,
            sortOrder: SortOrder.asc,
            truncate: true,
        },
        filter: (d) =>
            d.location.indexOf("International") === -1 &&
            (d.latest && d.latest.totalCases !== undefined
                ? d.latest.totalCases >= CASE_THRESHOLD
                : false),
        footer: (
            <React.Fragment>
                <p className="tiny">
                    Countries with less than {CASE_THRESHOLD} confirmed cases
                    are not shown. Cases from the Diamond Princess cruise ship
                    are also not shown since these numbers are no longer
                    changing over time.
                </p>
                <p>
                    Data source:{" "}
                    <a href="https://github.com/CSSEGISandData/COVID-19">
                        Johns Hopkins University CSSE
                    </a>
                    . Download the{" "}
                    <a href="https://ourworldindata.org/coronavirus-source-data">
                        full dataset
                    </a>
                    .
                </p>
            </React.Fragment>
        ),
    },
    deaths: {
        loadData: fetchJHUData,
        columns: [
            CovidTableColumnKey.location,
            CovidTableColumnKey.daysToDoubleDeaths,
            CovidTableColumnKey.totalDeaths,
            CovidTableColumnKey.newDeaths,
        ],
        mobileColumns: [
            CovidTableColumnKey.location,
            CovidTableColumnKey.daysToDoubleDeaths,
        ],
        defaultState: {
            sortKey: CovidSortKey.daysToDoubleDeaths,
            sortOrder: SortOrder.asc,
            truncate: true,
        },
        filter: (d) =>
            d.location.indexOf("International") === -1 &&
            (d.latest && d.latest.totalDeaths !== undefined
                ? d.latest.totalDeaths >= DEATH_THRESHOLD
                : false),
        footer: (
            <React.Fragment>
                <p className="tiny">
                    Countries with less than {DEATH_THRESHOLD} confirmed deaths
                    are not shown. Deaths from the Diamond Princess cruise ship
                    are also not shown since these numbers are no longer
                    changing over time.
                </p>
                <p>
                    Data source:{" "}
                    <a href="https://github.com/CSSEGISandData/COVID-19">
                        Johns Hopkins University CSSE
                    </a>
                    . Download the{" "}
                    <a href="https://ourworldindata.org/coronavirus-source-data">
                        full dataset
                    </a>
                    .
                </p>
            </React.Fragment>
        ),
    },
    tests: {
        loadData: fetchTestsData,
        columns: [
            CovidTableColumnKey.locationTests,
            CovidTableColumnKey.totalTests,
            CovidTableColumnKey.testDate,
            // CovidTableColumnKey.testSource
        ],
        mobileColumns: [
            CovidTableColumnKey.locationTests,
            CovidTableColumnKey.totalTests,
        ],
        defaultState: {
            sortKey: CovidSortKey.totalTests,
            sortOrder: SortOrder.desc,
        },
        extraRow: (props) => {
            if (props.datum.latestWithTests?.tests === undefined)
                return undefined
            const { date, tests } = props.datum.latestWithTests
            const {
                sourceURL,
                sourceLabel,
                publicationDate,
                remarks,
                nonOfficial,
            } = tests
            return (
                <td colSpan={3} className="testing-notes">
                    <span
                        className={classnames("official", {
                            "is-official": !nonOfficial,
                        })}
                    >
                        <Tippy
                            content={
                                <div className="covid-tooltip">
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
                    <span className="source">
                        <a href={sourceURL}>{sourceLabel}</a>
                    </span>
                    <br />
                </td>
            )
        },
    },
    deathsAndCases: {
        loadData: fetchJHUData,
        columns: [
            CovidTableColumnKey.location,
            CovidTableColumnKey.daysToDoubleDeaths,
            CovidTableColumnKey.totalDeaths,
            CovidTableColumnKey.newDeaths,
            CovidTableColumnKey.daysToDoubleCases,
            CovidTableColumnKey.totalCases,
            CovidTableColumnKey.newCases,
        ],
        mobileColumns: [
            CovidTableColumnKey.location,
            CovidTableColumnKey.daysToDoubleDeaths,
            CovidTableColumnKey.daysToDoubleCases,
        ],
        defaultState: {
            sortKey: CovidSortKey.totalDeaths,
            sortOrder: SortOrder.desc,
            truncate: true,
        },
        filter: (d) =>
            d.location.indexOf("International") === -1 &&
            (d.latest && d.latest.totalCases !== undefined
                ? d.latest.totalCases >= CASE_THRESHOLD
                : false),
        footer: (
            <React.Fragment>
                <p className="tiny">
                    Countries with less than {CASE_THRESHOLD} confirmed cases
                    are not shown. Cases from the Diamond Princess cruise ship
                    are also not shown since these numbers are no longer
                    changing over time.
                </p>
                <p>
                    Data source:{" "}
                    <a href="https://github.com/CSSEGISandData/COVID-19">
                        Johns Hopkins University CSSE
                    </a>
                    . Download the{" "}
                    <a href="https://ourworldindata.org/coronavirus-source-data">
                        full dataset
                    </a>
                    .
                </p>
            </React.Fragment>
        ),
    },
}

export function runCovid() {
    const elements = Array.from(
        document.querySelectorAll("*[data-covid-table], #covid-table-embed")
    )
    elements.forEach((element) => {
        const attr = element.getAttribute("data-measure")
        const measure = oneOf<Measure>(
            attr,
            ["tests", "deaths", "cases", "deathsAndCases"],
            "cases"
        )
        ReactDOM.render(<CovidTable {...propsByMeasure[measure]} />, element)
    })
}
