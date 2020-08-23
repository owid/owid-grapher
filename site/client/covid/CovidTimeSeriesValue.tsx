import * as React from "react"
import classnames from "classnames"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faQuestionCircle } from "@fortawesome/free-regular-svg-icons/faQuestionCircle"

import { Tippy } from "charts/core/Tippy"

import { formatDate } from "./CovidUtils"

export const CovidTimeSeriesValue = ({
    value,
    date,
    latest,
    tooltip,
    className,
    formattedDate,
    valueColor
}: {
    value: string | undefined
    date?: Date
    latest?: boolean
    tooltip?: JSX.Element | string
    className?: string
    formattedDate?: string
    valueColor?: string
}) => (
    <div className={classnames("time-series-value", className)}>
        {value !== undefined ? (
            <>
                <span className="count">
                    <span style={{ color: valueColor }}>{value}</span>{" "}
                    {tooltip && (
                        <Tippy content={tooltip} maxWidth={250}>
                            <span className="help-icon">
                                <FontAwesomeIcon icon={faQuestionCircle} />
                            </span>
                        </Tippy>
                    )}
                </span>
                <span className={classnames("date", { latest: latest })}>
                    {formattedDate ?? formatDate(date)}
                </span>
            </>
        ) : (
            undefined
        )}
    </div>
)
