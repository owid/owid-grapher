import * as React from "react"
import classnames from "classnames"

import { formatDate } from "./CovidUtils"

export const CovidTimeSeriesValue = ({
    value,
    date,
    latest
}: {
    value: string | undefined
    date: Date | undefined
    latest?: boolean
}) => (
    <div className="time-series-value">
        {value !== undefined ? (
            <>
                <span className="count">{value}</span>
                <span className={classnames("date", { latest: latest })}>
                    {formatDate(date)}
                </span>
            </>
        ) : (
            undefined
        )}
    </div>
)
