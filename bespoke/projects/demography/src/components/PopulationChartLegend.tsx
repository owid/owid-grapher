import { Tippy } from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import {
    BENCHMARK_LINE_COLOR,
    DENIM_BLUE,
    USER_MODIFIED_COLOR,
} from "../helpers/constants.js"
import { useTippyContainer } from "../../../../hooks/useTippyContainer.js"

export function PopulationChartLegend({
    userLabel = "Your projection",
    benchmarkLabel = "UN WPP Medium projection",
    userTooltip,
    benchmarkTooltip,
    modified = false,
}: {
    userLabel?: string
    benchmarkLabel?: string
    userTooltip?: string
    benchmarkTooltip?: string
    modified?: boolean
} = {}) {
    const userColor = modified ? USER_MODIFIED_COLOR : DENIM_BLUE
    const { ref: legendRef, getTippyContainer } =
        useTippyContainer<HTMLDivElement>()
    return (
        <div className="population-chart-legend" ref={legendRef}>
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
                {userTooltip && (
                    <Tippy content={userTooltip} placement="top" appendTo={getTippyContainer}>
                        <span className="population-chart-legend__info-icon">
                            <FontAwesomeIcon
                                icon={faCircleInfo}
                                size="sm"
                            />
                        </span>
                    </Tippy>
                )}
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
                {benchmarkTooltip && (
                    <Tippy content={benchmarkTooltip} placement="top" appendTo={getTippyContainer}>
                        <span className="population-chart-legend__info-icon">
                            <FontAwesomeIcon
                                icon={faCircleInfo}
                                size="sm"
                            />
                        </span>
                    </Tippy>
                )}
            </span>
        </div>
    )
}
