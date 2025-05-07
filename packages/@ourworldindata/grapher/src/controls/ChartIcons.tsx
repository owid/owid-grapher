import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faChartBar,
    faChartLine,
    faChartColumn,
} from "@fortawesome/free-solid-svg-icons"
import { GrapherChartType } from "@ourworldindata/types"

export const chartIcons: Record<GrapherChartType, React.ReactElement> = {
    // line chart
    LineChart: <FontAwesomeIcon icon={faChartLine} />,

    // bar charts
    DiscreteBar: <FontAwesomeIcon icon={faChartColumn} />,
    StackedBar: <FontAwesomeIcon icon={faChartColumn} />,
    StackedDiscreteBar: <FontAwesomeIcon icon={faChartBar} />,

    // scatter
    ScatterPlot: (
        <svg
            className="custom-icon scatter"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
        >
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

    // marimekko
    Marimekko: (
        <svg
            className="custom-icon marimekko"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
        >
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

    // stacked area
    StackedArea: (
        <svg
            className="custom-icon stacked-area"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
        >
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

    // slope chart
    SlopeChart: (
        <svg
            className="custom-icon slope"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
        >
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
}
