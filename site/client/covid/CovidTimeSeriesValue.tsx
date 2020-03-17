import * as React from "react"
import classnames from "classnames"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faQuestionCircle } from "@fortawesome/free-regular-svg-icons/faQuestionCircle"

import { Tippy } from "charts/Tippy"

import { formatDate } from "./CovidUtils"

export const CovidTimeSeriesValue = ({
    value,
    date,
    latest,
    tooltip
}: {
    value: string | undefined
    date: Date | undefined
    latest?: boolean
    tooltip?: JSX.Element | string
}) => (
    <div className="time-series-value">
        {value !== undefined ? (
            <>
                <span className="count">
                    {value}{" "}
                    {tooltip && (
                        <Tippy content={tooltip} maxWidth={250}>
                            <span className="help-icon">
                                <FontAwesomeIcon icon={faQuestionCircle} />
                            </span>
                        </Tippy>
                    )}
                </span>
                <span className={classnames("date", { latest: latest })}>
                    {formatDate(date)}
                </span>
            </>
        ) : (
            undefined
        )}
    </div>
)
