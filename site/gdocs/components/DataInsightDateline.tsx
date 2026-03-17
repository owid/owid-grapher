import cx from "classnames"
import { faCalendarDay } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import { dayjs } from "@ourworldindata/utils"

export default function DataInsightDateline({
    className,
    publishedAt,
    formatOptions = {
        month: "long",
        day: "numeric",
    },
    highlightToday,
}: {
    className?: string
    publishedAt: Date | null
    formatOptions?: Intl.DateTimeFormatOptions
    highlightToday?: boolean
}) {
    const date = dayjs.utc(publishedAt)
    let highlightClassName
    let formattedDate
    if (publishedAt) {
        if (date.isSame(dayjs.utc(), "day")) {
            formattedDate = "Today"
            if (highlightToday) {
                highlightClassName = "data-insight-dateline--is-today"
            }
        } else if (date.isSame(dayjs.utc().subtract(1, "day"), "day")) {
            formattedDate = "Yesterday"
        } else {
            const options =
                date.year() !== dayjs.utc().year()
                    ? { ...formatOptions, year: "numeric" as const }
                    : formatOptions
            formattedDate = date.toDate().toLocaleDateString("en-US", {
                ...options,
                timeZone: "UTC",
            })
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
