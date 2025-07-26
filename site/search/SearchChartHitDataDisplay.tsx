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
}

export function SearchChartHitDataDisplay({
    entityName,
    endValue,
    time,
    unit,
    startValue,
    trend,
    showLocationIcon,
}: SearchChartHitDataDisplayProps): React.ReactElement | null {
    // Remove parentheses from the beginning and end of the unit
    const strippedUnit = unit?.replace(/(^\(|\)$)/g, "")

    return (
        <div className="search-chart-hit-data-display">
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
                {strippedUnit && (
                    <span className="search-chart-hit-data-display__unit">
                        {strippedUnit}
                    </span>
                )}
                <span className="search-chart-hit-data-display__unit">
                    {strippedUnit ? ", " : ""}
                    {time}
                </span>
            </div>
        </div>
    )
}
