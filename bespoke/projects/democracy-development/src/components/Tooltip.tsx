import { useLayoutEffect, useRef, useState } from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"

import type { Feed } from "../core/feed.js"
import type { Datum, EntityId, IndexKey } from "../core/types.js"
import { OUTCOME_KEYS } from "../core/types.js"
import { X_VARS, Y_VARS } from "../core/constants.js"
import type { HoverContext } from "./ScatterPanel.js"

export function formatPopulation(v: number): string {
    return v >= 1e9
        ? (v / 1e9).toFixed(2) + " billion"
        : v >= 1e6
          ? (v / 1e6).toFixed(1) + " million"
          : Math.round(v).toLocaleString("en-US")
}

interface TooltipProps {
    feed: Feed
    eid: EntityId
    xKey: IndexKey
    year: number
    context: HoverContext
    sizeByPopulation: boolean
    /** The element the tooltip is positioned in, and the scale it is drawn at */
    frame: HTMLElement | null
    scale: number
}

/**
 * The grapher scatter tooltip: the panel's measure first, the democracy score second, the other
 * measures as a list, and a notice when a value comes from a neighbouring year.
 */
export function Tooltip({
    feed,
    eid,
    xKey,
    year,
    context,
    sizeByPopulation,
    frame,
    scale,
}: TooltipProps): React.ReactElement {
    const ref = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

    // Position beside the cursor, inside the frame, flipping to the other side where it would overflow.
    useLayoutEffect(() => {
        const tip = ref.current
        if (!tip || !frame || context.fixed) {
            setPos(null)
            return
        }
        const fr = frame.getBoundingClientRect()
        const cx = (context.clientX - fr.left) / scale
        const cy = (context.clientY - fr.top) / scale
        const fw = fr.width / scale
        const fh = fr.height / scale
        const tw = tip.offsetWidth
        const th = tip.offsetHeight
        let left = cx + 16
        let top = cy + 16
        if (left + tw > fw - 8) left = cx - tw - 16
        if (top + th > fh - 8) top = Math.max(8, cy - th - 16)
        setPos({ left, top })
    }, [context, frame, scale, eid, year, xKey])

    const x = X_VARS[xKey]
    const xv = feed.valueAt(xKey, eid, year)
    const main = Y_VARS[context.panel]
    const mainValue = feed.outcomeAt(context.panel, eid, year)
    const others = OUTCOME_KEYS.filter((k) => k !== context.panel).map((k) => ({
        key: k,
        datum: feed.outcomeAt(k, eid, year),
    }))
    const pop = sizeByPopulation ? feed.popAt(eid, year) : null

    const notices = new Set<number>()
    const note = (d: Datum | null): void => {
        if (d && d.year !== year) notices.add(d.year)
    }
    note(mainValue)
    note(xv)
    others.forEach((o) => note(o.datum))
    const noticeYears = [...notices].sort((a, b) => a - b)

    const valueBlock = (
        name: string,
        unit: string,
        datum: Datum | null,
        fmt: (v: number) => string
    ) => (
        <div className="variable">
            <div className="definition">
                <span className="name">{name}</span>
                {unit && <span className="unit">{unit}</span>}
            </div>
            <div className="values">
                {datum ? (
                    <>
                        <span className="term">{fmt(datum.value)}</span>
                        {datum.year !== year && (
                            <span className="time-notice">
                                <FontAwesomeIcon icon={faCircleInfo} />
                                {datum.year}
                            </span>
                        )}
                    </>
                ) : (
                    <span className="term no-data">No data</span>
                )}
            </div>
        </div>
    )

    return (
        <div
            ref={ref}
            className={cx("tooltip-container", "dd-tooltip", {
                "fixed-bottom": context.fixed,
            })}
            style={pos ? { left: pos.left, top: pos.top } : undefined}
        >
            <div className="Tooltip">
                <div className="frontmatter">
                    <p className="title">
                        {feed.entities[eid]}
                        <span className="annotation">
                            {feed.continentOf[eid]}
                        </span>
                    </p>
                    <p className="subtitle">{year}</p>
                </div>
                <div className="content">
                    {valueBlock(
                        main.tooltipName,
                        main.tooltipUnit,
                        mainValue,
                        main.fmt
                    )}
                    {valueBlock(x.tooltipName, "", xv, x.fmt)}
                    <table className="series-list">
                        <tbody>
                            {pop !== null && (
                                <tr>
                                    <td className="series-name">Population</td>
                                    <td className="series-value">
                                        {formatPopulation(pop)}
                                    </td>
                                </tr>
                            )}
                            {others.map(({ key, datum }) => {
                                const y = Y_VARS[key]
                                return (
                                    <tr key={key}>
                                        <td className="series-name">
                                            {y.tooltipName}
                                        </td>
                                        <td
                                            className={cx("series-value", {
                                                missing: !datum,
                                            })}
                                        >
                                            {datum ? (
                                                <>
                                                    {y.fmt(datum.value)}
                                                    {datum.year !== year && (
                                                        <span className="yr">
                                                            {datum.year}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                "No data"
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                {noticeYears.length > 0 && (
                    <div className="endmatter">
                        <div className="line">
                            <FontAwesomeIcon icon={faCircleInfo} />
                            <span>
                                Data not available for {year}. Showing closest
                                available data point
                                {noticeYears.length > 1 ? "s" : ""} (
                                {noticeYears.join(", ")}) instead
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
