import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faChartBar,
    faChartColumn,
    faChartLine,
    faEarthAmericas,
    faTable,
} from "@fortawesome/free-solid-svg-icons"
import {
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_NAMES,
    GrapherChartType,
    GrapherTabName,
} from "@ourworldindata/types"

export function GrapherTabIcon({
    tab,
}: {
    tab: GrapherTabName
}): React.ReactElement {
    switch (tab) {
        case GRAPHER_TAB_NAMES.Table:
            return <FontAwesomeIcon icon={faTable} />
        case GRAPHER_TAB_NAMES.WorldMap:
            return <FontAwesomeIcon icon={faEarthAmericas} />
        default:
            return chartIcons[tab]
    }
}

const chartIcons: Record<GrapherChartType, React.ReactElement> = {
    // Line chart
    [GRAPHER_CHART_TYPES.LineChart]: <FontAwesomeIcon icon={faChartLine} />,

    // Bar charts
    [GRAPHER_CHART_TYPES.DiscreteBar]: <FontAwesomeIcon icon={faChartColumn} />,
    [GRAPHER_CHART_TYPES.StackedBar]: <FontAwesomeIcon icon={faChartColumn} />,
    [GRAPHER_CHART_TYPES.StackedDiscreteBar]: (
        <FontAwesomeIcon icon={faChartBar} />
    ),

    // Scatter
    [GRAPHER_CHART_TYPES.ScatterPlot]: (
        <svg width="13" height="13" fill="none" viewBox="2 1.5 13 13">
            <path
                fill="currentColor"
                fillRule="evenodd"
                d="M13.2 14h-10A1.2 1.2 0 0 1 2 12.8v-10a.8.8 0 1 1 1.6 0V12c0 .22.18.4.4.4h9.2a.8.8 0 0 1 0 1.6m-.16-10a1.04 1.04 0 1 1-2.08 0 1.04 1.04 0 0 1 2.08 0m-1.6 3.6a1.04 1.04 0 1 1-2.08 0 1.04 1.04 0 0 1 2.08 0m-4 2a1.04 1.04 0 1 1-2.08 0 1.04 1.04 0 0 1 2.08 0m.8-4.8a1.04 1.04 0 1 1-2.08 0 1.04 1.04 0 0 1 2.08 0"
                clipRule="evenodd"
            />
        </svg>
    ),

    // Marimekko
    [GRAPHER_CHART_TYPES.Marimekko]: (
        <svg width="13" height="13" fill="none" viewBox="1 2 14 13">
            <path
                fill="currentColor"
                stroke="currentColor"
                strokeWidth=".1"
                d="M13.5 1.45h-11A1.05 1.05 0 0 0 1.45 2.5v11a1.05 1.05 0 0 0 1.05 1.05h11a1.05 1.05 0 0 0 1.05-1.05v-11a1.05 1.05 0 0 0-1.05-1.05Zm-.05 3.5h-2.9v-2.4h2.9zm-4-1h-2.9v-1.4h2.9zm0 1.1v3.9h-2.9v-3.9zm-4 5.9h-2.9v-4.9h2.9zm1.1-.9h2.9v3.4h-2.9zm4-4h2.9v1.9h-2.9zm-5.1-3.5v2.4h-2.9v-2.4zm-2.9 9.5h2.9v1.4h-2.9zm8 1.4v-4.4h2.9v4.4z"
            />
        </svg>
    ),

    // Stacked area
    [GRAPHER_CHART_TYPES.StackedArea]: (
        <svg width="13" height="13" fill="none" viewBox="0 0 14 14">
            <g
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
            >
                <path d="M1 12.458V1.542L5.764 4.06l7.145-2.52v10.917H1Z" />
                <path d="m1 9.481 4.764-1.985 7.145 1.191" />
            </g>
        </svg>
    ),

    // Slope chart
    [GRAPHER_CHART_TYPES.SlopeChart]: (
        <svg width="13" height="13" fill="none" viewBox="1 1 14 14">
            <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
                d="M2 2.3v11.267M14 2.3v11.267M2 3.3l12 9M2 11l12 1m0-7.7-12 5"
            />
        </svg>
    ),

    // Dumbbell
    [GRAPHER_CHART_TYPES.Dumbbell]: (
        <svg width="13" height="13" fill="none" viewBox="1 1 13 13">
            <path
                fill="currentColor"
                d="M11.991 10.295a1.51 1.51 0 0 1 0 3.017c-.518 0-.974-.262-1.246-.66h-2.22a1.508 1.508 0 1 1 .107-1.508h2.005a1.51 1.51 0 0 1 1.354-.85m0-4.148a1.508 1.508 0 1 1-1.304 2.262H4.813A1.506 1.506 0 0 1 2 7.655a1.508 1.508 0 0 1 2.813-.754h5.874c.26-.45.746-.753 1.304-.754M8.221 2a1.509 1.509 0 1 1-1.246 2.356h-2.22A1.507 1.507 0 0 1 2 3.508a1.508 1.508 0 0 1 2.862-.66h2.004A1.51 1.51 0 0 1 8.221 2"
            />
        </svg>
    ),

    // Swimlane
    [GRAPHER_CHART_TYPES.Swimlane]: (
        <svg width="13" height="13" fill="none" viewBox="1 1 14 13">
            <path
                fill="currentColor"
                d="M6 11a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1zm8-5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM8 1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"
            />
        </svg>
    ),
}
