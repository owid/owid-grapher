import * as React from "react"
import cx from "classnames"
import { faCalendarDay } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

import { dayjs } from "@ourworldindata/utils"

export default function DataInsightDateline({
    className,
    publishedAt,
    formatOptions = {
        month: "long",
        day: "2-digit",
    },
    highlightToday,
}: {
    className?: string
    publishedAt: Date | null
    formatOptions?: Intl.DateTimeFormatOptions
    highlightToday?: boolean
}) {
    const date = dayjs(publishedAt)
    let highlightClassName
    let formattedDate
    if (publishedAt) {
        if (date.isToday()) {
            formattedDate = "Today"
            if (highlightToday) {
                highlightClassName = "data-insight-dateline--is-today"
            }
        } else if (date.isYesterday()) {
            formattedDate = "Yesterday"
        } else {
            formattedDate = publishedAt.toLocaleDateString(
                "en-US",
                formatOptions
            )
        }
    } else {
        formattedDate = "Unpublished"
    }
    return (
        <p
            className={cx(
                "data-insight-dateline",
                className,
                highlightClassName
            )}
        >
            <FontAwesomeIcon
                className="data-insight-dateline__icon"
                icon={faCalendarDay}
            />
            {formattedDate}
        </p>
    )
}
