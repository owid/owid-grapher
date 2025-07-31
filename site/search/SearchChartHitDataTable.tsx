import cx from "classnames"
import * as R from "remeda"

interface TableRow {
    color: string
    name: string
    value: string
    time?: string
    timePreposition?: string // defaults to 'in'
    muted?: boolean
    striped?: boolean
}

export interface SearchChartHitDataTableProps {
    rows: TableRow[]
    title: string
}

export function SearchChartHitDataTable({
    rows,
    title,
}: SearchChartHitDataTableProps): React.ReactElement {
    // Show the time in the title if all items refer to the same time
    const time = rows[0]?.time
    const shouldShowTimeInTitle =
        time !== undefined && rows.every((row) => row.time === time)

    // Hide the time in each row if it's shown in the title
    const displayRows = shouldShowTimeInTitle
        ? rows.map((item) => R.omit(item, ["time"]))
        : rows

    return (
        <div className="search-chart-hit-table">
            <div className="search-chart-hit-table-content">
                <Header
                    title={title}
                    time={shouldShowTimeInTitle ? time : undefined}
                />
                {displayRows.map((row) => (
                    <Row
                        key={row.name}
                        row={row}
                        shouldSpanBothColumns={rows.length <= 4}
                    />
                ))}
            </div>
        </div>
    )
}

function Header({
    title,
    time,
}: {
    title: string
    time?: string
}): React.ReactElement {
    return (
        <div className="search-chart-hit-table-header search-chart-hit-table-row col-span">
            <span className="search-chart-hit-table-header__title">
                {title}
            </span>
            {time && <span>, {time}</span>}
        </div>
    )
}

function Row({
    row,
    shouldSpanBothColumns,
}: {
    row: TableRow
    shouldSpanBothColumns: boolean
}): React.ReactElement {
    return (
        <div
            className={cx("search-chart-hit-table-row", {
                "col-span": shouldSpanBothColumns,
                "search-chart-hit-table-row--muted": row.muted,
            })}
        >
            <span
                className={cx("search-chart-hit-table-row__swatch", {
                    "search-chart-hit-table-row__swatch--striped": row.striped,
                })}
                style={{ backgroundColor: row.color }}
            />
            <span className="search-chart-hit-table-row__name">{row.name}</span>
            <span className="search-chart-hit-table-row__spacer" />
            <span className="search-chart-hit-table-row__value">
                {row.value}
                {row.time && (
                    <span className="search-chart-hit-table-row__time">
                        {" "}
                        {row.timePreposition ?? "in"} {row.time}
                    </span>
                )}
            </span>
        </div>
    )
}
