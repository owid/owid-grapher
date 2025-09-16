import cx from "classnames"
import * as R from "remeda"
import { SearchChartHitDataTableProps } from "@ourworldindata/types"
import { GrapherTrendArrow } from "@ourworldindata/components"

export function SearchChartHitDataTable({
    rows,
    title,
}: SearchChartHitDataTableProps): React.ReactElement {
    // Show the time in the title if all items refer to the same time
    const times = rows.map((row) => row.time).filter((time) => time)
    const mainTime = times[0]
    const shouldShowTimeInTitle =
        mainTime !== undefined && times.every((time) => time === mainTime)

    // Hide the time in each row if it's shown in the title
    const displayRows = shouldShowTimeInTitle
        ? rows.map((item) => R.omit(item, ["time"]))
        : rows

    // Hide the color in each row if all rows share the same color
    const shouldShowSwatch =
        rows.length <= 1 || rows.some((row) => row.color !== rows[0].color)

    return (
        <div className="search-chart-hit-table">
            <Header
                title={title}
                time={shouldShowTimeInTitle ? mainTime : undefined}
                timePreposition={rows[0]?.timePreposition}
            />
            {displayRows.map((row) => (
                <Row
                    key={row.label}
                    row={row}
                    shouldShowSwatch={shouldShowSwatch}
                    shouldSpanBothColumns={displayRows.length <= 4}
                />
            ))}
        </div>
    )
}

function Header({
    title,
    time,
    timePreposition = "in",
}: {
    title: string
    time?: string
    timePreposition?: string
}): React.ReactElement {
    return (
        <div className="search-chart-hit-table-header search-chart-hit-table-row col-span">
            <span className="search-chart-hit-table-header__title">
                {title}
            </span>
            {time && (
                <span>
                    , {timePreposition} {time}
                </span>
            )}
        </div>
    )
}

function Row({
    row,
    shouldShowSwatch = true,
    shouldSpanBothColumns,
}: {
    row: SearchChartHitDataTableProps["rows"][number]
    shouldShowSwatch?: boolean
    shouldSpanBothColumns: boolean
}): React.ReactElement {
    return (
        <div
            className={cx("search-chart-hit-table-row", {
                "col-span": shouldSpanBothColumns,
                "search-chart-hit-table-row--muted": row.muted,
            })}
        >
            {shouldShowSwatch && row.color && (
                <span
                    className={cx("search-chart-hit-table-row__swatch", {
                        "search-chart-hit-table-row__swatch--outlined":
                            row.outlined,
                        "search-chart-hit-table-row__swatch--striped":
                            row.striped,
                        "search-chart-hit-table-row__swatch--no-data":
                            row.striped === "no-data",
                    })}
                    style={{ backgroundColor: row.color }}
                />
            )}
            <span className="search-chart-hit-table-row__name">
                {row.label}
            </span>
            {row.value !== undefined && (
                <>
                    <span className="search-chart-hit-table-row__spacer" />
                    <span className="search-chart-hit-table-row__value">
                        {row.startValue && (
                            <>
                                {row.startValue}
                                <GrapherTrendArrow
                                    className="search-chart-hit-table-row__arrow"
                                    direction={row.trend ?? "right"}
                                />
                            </>
                        )}
                        {row.value}
                        {row.time && (
                            <span className="search-chart-hit-table-row__time">
                                {" "}
                                {row.timePreposition ?? "in"} {row.time}
                            </span>
                        )}
                    </span>
                </>
            )}
        </div>
    )
}
