import cx from "classnames"
import { faLocationDot } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { GrapherTrendArrow } from "@ourworldindata/components"

export interface SearchChartHitDataDisplayProps {
    entityName: string
    endValue: string
    time: string
    unit?: string
    startValue?: string // if given, display as a range
    trend?: "down" | "right" | "up" // only relevant if startValue is given
    showLocationIcon?: boolean
    className?: string
}

export function SearchChartHitDataDisplay({
    entityName,
    endValue,
    time,
    unit,
    startValue,
    trend,
    showLocationIcon,
    className,
}: SearchChartHitDataDisplayProps): React.ReactElement | null {
    return (
        <div className={cx("search-chart-hit-data-display", className)}>
            <div className="search-chart-hit-data-display__location">
                {showLocationIcon && (
                    <FontAwesomeIcon
                        className="search-chart-hit-data-display__icon"
                        icon={faLocationDot}
                        size="sm"
                    />
                )}
                {entityName}
            </div>
            <div className="search-chart-hit-data-display__value">
                {startValue && (
                    <>
                        {startValue}
                        <GrapherTrendArrow direction={trend ?? "right"} />
                    </>
                )}
                {endValue}
            </div>
            <div className="search-chart-hit-data-display__unit-time">
                {unit && (
                    <>
                        <span className="search-chart-hit-data-display__unit">
                            {unit}
                        </span>
                        ,{" "}
                    </>
                )}
                {time}
            </div>
        </div>
    )
}
