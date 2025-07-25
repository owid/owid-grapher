import cx from "classnames"

interface TableRow {
    color: string
    name: string
    value: string
    time?: string
    muted?: boolean
    striped?: boolean
}

export function SearchChartHitTableContent({
    rows,
    title,
    time,
}: {
    rows: TableRow[]
    title: string
    time?: string
}): React.ReactElement {
    return (
        <div className="search-chart-hit-table-content">
            <Header title={title} time={time} />
            {rows.map((row) => (
                <Row
                    key={row.name}
                    row={row}
                    shouldSpanBothColumns={rows.length <= 4}
                />
            ))}
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
                        in {row.time}
                    </span>
                )}
            </span>
        </div>
    )
}
