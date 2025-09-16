import React from "react"
import cx from "classnames"
import { SearchChartHitDataPointsProps } from "@ourworldindata/types"
import { GrapherTrendArrow } from "@ourworldindata/components"

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
    dataPoint: SearchChartHitDataPointsProps["dataPoints"][number]
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
