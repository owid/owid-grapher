import React from "react"
import cx from "classnames"
import {
    GrapherTrendArrow,
    GrapherTrendArrowDirection,
} from "@ourworldindata/components"

interface DataPoint {
    columnName: string
    unit?: string
    time: string
    entityName: string
    value: string
    startValue?: string
    trend?: GrapherTrendArrowDirection // only relevant if startValue is given
}

export interface SearchChartHitDataPointsProps {
    dataPoints: DataPoint[]
}

export function SearchChartHitDataPoints({
    dataPoints,
}: SearchChartHitDataPointsProps): React.ReactElement {
    return (
        <div
            className={cx("search-chart-hit-data-points", {
                "search-chart-hit-data-points--align-top":
                    dataPoints.length < 2,
            })}
        >
            {dataPoints.map((point, index) => (
                <React.Fragment key={index}>
                    {index > 0 && (
                        <div className="search-chart-hit-data-points__separator" />
                    )}
                    <DataPoint dataPoint={point} />
                </React.Fragment>
            ))}
        </div>
    )
}

function DataPoint({
    dataPoint,
}: {
    dataPoint: DataPoint
}): React.ReactElement {
    return (
        <div className="search-chart-hit-data-point">
            <div className="search-chart-hit-data-point__label">
                <span className="search-chart-hit-data-point__title">
                    {dataPoint.columnName}
                </span>
                {dataPoint.unit && ` (${dataPoint.unit})`}, {dataPoint.time},{" "}
                {dataPoint.entityName}
            </div>
            <div className="search-chart-hit-data-point__value">
                {dataPoint.startValue && (
                    <>
                        {dataPoint.startValue}
                        <GrapherTrendArrow
                            className="search-chart-hit-data-point__arrow"
                            direction={dataPoint.trend ?? "right"}
                        />
                    </>
                )}
                {dataPoint.value}
            </div>
        </div>
    )
}
