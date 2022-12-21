import React from "react"
import classnames from "classnames"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faQuestionCircle } from "@fortawesome/free-regular-svg-icons/faQuestionCircle"

import { Tippy } from "../chart/Tippy"

export const SparkBarTimeSeriesValue = ({
    value,
    latest,
    tooltip,
    className,
    displayDate,
    valueColor,
}: {
    value: string | undefined
    latest?: boolean
    tooltip?: JSX.Element | string
    className?: string
    displayDate?: string
    valueColor?: string
}): JSX.Element => (
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
                    {displayDate}
                </span>
            </>
        ) : undefined}
    </div>
)
