import cx from "classnames"
import { faCalendarDay } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { formatRelativeDate } from "@ourworldindata/utils"

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
    const formattedDate = formatRelativeDate({
        publishedAt,
        now: new Date(),
        formatOptions,
    })
    const highlightClassName =
        highlightToday && publishedAt && formattedDate === "Today"
            ? "data-insight-dateline--is-today"
            : undefined

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
