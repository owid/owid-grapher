import React from "react"
import classnames from "classnames"

export const SparkBarTimeSeriesValue = ({
    value,
    latest,
    className,
    displayDate,
}: {
    value: string | undefined
    latest?: boolean
    className?: string
    displayDate?: string
}): JSX.Element => (
    <div className={classnames("time-series-value", className)}>
        {value !== undefined ? (
            <>
                <span className="count">{value}</span>
                <span className={classnames("date", { latest: latest })}>
                    {displayDate}
                </span>
            </>
        ) : undefined}
    </div>
)
