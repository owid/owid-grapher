import {
    BENCHMARK_LINE_COLOR,
    DENIM_BLUE,
    USER_MODIFIED_COLOR,
} from "../helpers/constants.js"

export function PopulationChartLegend({
    userLabel = "Your projection",
    benchmarkLabel = "UN WPP Medium projection",
    modified = false,
}: {
    userLabel?: string
    benchmarkLabel?: string
    modified?: boolean
} = {}) {
    const userColor = modified ? USER_MODIFIED_COLOR : DENIM_BLUE
    return (
        <div className="population-chart-legend">
            <span className="population-chart-legend__item">
                <svg width="16" height="6">
                    <line
                        x1="0"
                        y1="3"
                        x2="16"
                        y2="3"
                        stroke={userColor}
                        strokeWidth="4"
                        strokeDasharray="1.5,2"
                        strokeLinecap="butt"
                    />
                </svg>
                <span className="population-chart-legend__label">
                    {userLabel}
                </span>
            </span>
            <span className="population-chart-legend__item">
                <svg width="16" height="6">
                    <line
                        x1="0"
                        y1="3"
                        x2="16"
                        y2="3"
                        stroke={BENCHMARK_LINE_COLOR}
                        strokeWidth="4"
                        strokeDasharray="1.5,2"
                        strokeLinecap="butt"
                    />
                </svg>
                <span className="population-chart-legend__label">
                    {benchmarkLabel}
                </span>
            </span>
        </div>
    )
}
