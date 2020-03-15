import * as React from "react"

import { CovidDoublingRange, NounGenerator } from "./CovidTypes"
import { formatInt, formatDate } from "./CovidUtils"

export const CovidDoublingTooltip = (props: {
    caseDoublingRange: CovidDoublingRange
    noun: NounGenerator
}) => {
    const { noun } = props
    const { latestDay, halfDay, ratio, length } = props.caseDoublingRange
    return (
        <div className="covid-tooltip">
            The total confirmed cases in {latestDay.location} have increased by{" "}
            <span className="growth-rate">{ratio.toFixed(1)}x</span> in the{" "}
            <span className="period">last {length} days</span>.
            <table className="values">
                <tr>
                    <td className="value from-color">
                        {formatInt(halfDay.total_cases)}{" "}
                        {noun(halfDay.total_cases)}
                    </td>
                    <td>on</td>
                    <td className="date from-color">
                        {formatDate(halfDay.date)}
                    </td>
                </tr>
                <tr>
                    <td className="value to-color">
                        {formatInt(latestDay.total_cases)}{" "}
                        {noun(latestDay.total_cases)}
                    </td>
                    <td>on</td>
                    <td className="date to-color">
                        {formatDate(latestDay.date)}
                    </td>
                </tr>
            </table>
        </div>
    )
}
