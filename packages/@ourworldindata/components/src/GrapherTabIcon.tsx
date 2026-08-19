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
        <svg width="13" height="13" viewBox="2 1.5 13 13" fill="none">
            <g clipPath="url(#a)">
                <path
                    fill="currentColor"
                    fillRule="evenodd"
                    d="M13.2 14h-10A1.2 1.2 0 0 1 2 12.8v-10a.8.8 0 1 1 1.6 0V12c0 .22.18.4.4.4h9.2a.8.8 0 0 1 0 1.6Zm-.16-10a1.04 1.04 0 1 1-2.08 0 1.04 1.04 0 0 1 2.08 0Zm-.24 0Zm-1.36 3.6a1.04 1.04 0 1 1-2.08 0 1.04 1.04 0 0 1 2.08 0Zm-.24 0Zm-3.76 2a1.04 1.04 0 1 1-2.08 0 1.04 1.04 0 0 1 2.08 0Zm-.24 0Zm1.04-4.8a1.04 1.04 0 1 1-2.08 0 1.04 1.04 0 0 1 2.08 0Z"
                    clipRule="evenodd"
                />
            </g>
            <defs>
                <clipPath id="a">
                    <path fill="#fff" d="M0 0h16v16H0z" />
                </clipPath>
            </defs>
        </svg>
    ),

    // Marimekko
    [GRAPHER_CHART_TYPES.Marimekko]: (
        <svg width="13" height="13" viewBox="1 2 14 13" fill="none">
            <g clipPath="url(#a)">
                <path
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth=".1"
                    d="M13.5 1.45h-11A1.051 1.051 0 0 0 1.45 2.5v11a1.051 1.051 0 0 0 1.05 1.05h11a1.051 1.051 0 0 0 1.05-1.05v-11a1.051 1.051 0 0 0-1.05-1.05Zm-.05 3.5h-2.9v-2.4h2.9v2.4Zm-4-1h-2.9v-1.4h2.9v1.4Zm0 1.1v3.9h-2.9v-3.9h2.9Zm-4 5.9h-2.9v-4.9h2.9v4.9Zm1.1-.9h2.9v3.4h-2.9v-3.4Zm4-4h2.9v1.9h-2.9v-1.9Zm-5.1-3.5v2.4h-2.9v-2.4h2.9Zm-2.9 9.5h2.9v1.4h-2.9v-1.4Zm8 1.4v-4.4h2.9v4.4h-2.9Z"
                />
            </g>
            <defs>
                <clipPath id="a">
                    <path fill="#fff" d="M0 0h16v16H0z" />
                </clipPath>
            </defs>
        </svg>
    ),

    // Stacked area
    [GRAPHER_CHART_TYPES.StackedArea]: (
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
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
        <svg width="13" height="13" viewBox="1 1 14 14" fill="none">
            <g
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M2 2.30005V13.5667" />
                <path d="M14 2.30005V13.5667" />
                <path d="M2 3.30005L14 12.3" />
                <path d="M2 11L14 12" />
                <path d="M14 4.30005L2 9.30005" />
            </g>
        </svg>
    ),

    // Dumbbell
    [GRAPHER_CHART_TYPES.Dumbbell]: (
        <svg width="13" height="13" viewBox="1 1 13 13" fill="none">
            <path
                d="M11.9912 10.2949C12.8241 10.2949 13.5 10.9708 13.5 11.8037C13.4998 12.6365 12.824 13.3115 11.9912 13.3115C11.473 13.3114 11.0165 13.0495 10.7451 12.6514H8.52539C8.25391 13.0495 7.79657 13.3105 7.27832 13.3105C6.44549 13.3104 5.77051 12.6356 5.77051 11.8027C5.77055 10.9699 6.44551 10.295 7.27832 10.2949C7.87445 10.2949 8.38797 10.6415 8.63281 11.1436H10.6367C10.8816 10.6417 11.3953 10.295 11.9912 10.2949ZM11.9912 6.14746C12.8241 6.14746 13.5 6.82238 13.5 7.65527C13.5 8.4882 12.8241 9.16309 11.9912 9.16309C11.4333 9.16299 10.9473 8.85965 10.6865 8.40918H4.8125C4.55164 8.85958 4.06575 9.16309 3.50781 9.16309C2.67504 9.1629 2 8.48809 2 7.65527C2.00004 6.82249 2.67507 6.14764 3.50781 6.14746C4.0657 6.14746 4.55162 6.45103 4.8125 6.90137H10.6865C10.9473 6.45096 11.4333 6.14756 11.9912 6.14746ZM8.2207 2C9.05352 2 9.72931 2.67504 9.72949 3.50781C9.72949 4.34074 9.05363 5.0166 8.2207 5.0166C7.70262 5.01647 7.24603 4.75449 6.97461 4.35645H4.75488C4.48341 4.75466 4.02612 5.0166 3.50781 5.0166C2.67503 5.01643 2 4.34063 2 3.50781C2.00018 2.67515 2.67514 2.00017 3.50781 2C4.10385 2 4.61742 2.34675 4.8623 2.84863H6.86621C7.11099 2.34671 7.62472 2.00015 8.2207 2Z"
                fill="currentColor"
            />
        </svg>
    ),
}
