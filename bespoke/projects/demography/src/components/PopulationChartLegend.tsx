import { PROJECTION_DASHARRAY } from "../helpers/constants.js"

export function PopulationChartLegend() {
    return (
        <div className="population-chart-legend">
            <span className="population-chart-legend__item">
                <svg width="16" height="6">
                    <line
                        x1="0"
                        y1="3"
                        x2="16"
                        y2="3"
                        stroke="#4c6a9c"
                        strokeWidth="3"
                        strokeDasharray={PROJECTION_DASHARRAY}
                        strokeLinecap="butt"
                    />
                </svg>
                <span className="population-chart-legend__label">
                    Configured projection
                </span>
            </span>
            <span className="population-chart-legend__item">
                <svg width="16" height="6">
                    <line
                        x1="0"
                        y1="3"
                        x2="16"
                        y2="3"
                        stroke="#bbb"
                        strokeWidth="3"
                        strokeDasharray={PROJECTION_DASHARRAY}
                        strokeLinecap="butt"
                    />
                </svg>
                <span className="population-chart-legend__label">
                    UN WPP Medium projection
                </span>
            </span>
        </div>
    )
}
