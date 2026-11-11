import * as React from "react"
import { Tooltip } from "antd"
import { dayjs } from "@ourworldindata/utils"

// Cells shared by the admin's lists of charts and of multi-dims, so the two
// read the same way. They use ChartList.scss's `chart-list__*` classes.

export type Highlighter = (
    text: string | null | undefined
) => string | React.ReactElement

/** "1 year ago" rather than dayjs's "a year ago", so the times line up as numbers */
function timeAgo(time: string): string {
    return dayjs(time)
        .fromNow()
        .replace(/^an? (minute|hour|day|month|year) ago$/, "1 $1 ago")
}

/**
 * "7 hours ago" over the author's name, with the exact time on hover. Clicking
 * the name lists only that person's charts, as on GitHub.
 */
export function TimestampCell({
    time,
    by,
    highlight,
    onAuthorClick,
}: {
    time: string | undefined
    by?: string
    highlight?: Highlighter
    onAuthorClick?: (author: string) => void
}): React.ReactElement {
    if (!time) return <span className="text-muted">—</span>
    return (
        <div className="chart-list__timestamp">
            <Tooltip title={dayjs(time).format("D MMM YYYY, HH:mm")}>
                <span className="chart-list__time">{timeAgo(time)}</span>
            </Tooltip>
            {by && (
                <div>
                    <button
                        type="button"
                        className="chart-list__author"
                        title={`Only charts by ${by}`}
                        onClick={() => onAuthorClick?.(by)}
                    >
                        {highlight ? highlight(by) : by}
                    </button>
                </div>
            )}
        </div>
    )
}

export function CountCell({
    count,
}: {
    count: number | null
}): React.ReactElement {
    if (!count) return <span className="text-muted">0</span>
    return <>{count.toLocaleString()}</>
}

/** A header whose explanation shows on hovering its dotted-underlined text */
export function HeaderWithHelp({
    title,
    help,
}: {
    title: string
    help: string
}): React.ReactElement {
    return (
        <Tooltip title={help}>
            <span className="chart-list__header-help">{title}</span>
        </Tooltip>
    )
}
