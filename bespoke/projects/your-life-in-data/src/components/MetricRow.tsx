import cx from "clsx"

import type { CardRow } from "../types.js"
import { formatValue } from "../helpers/format.js"
import { Sparkline } from "./Sparkline.js"

/**
 * One metric row: label (linking to the full chart) · then value · sparkline ·
 * now value, with the comparison entity's numbers in small type underneath.
 */
export function MetricRow({
    row,
    domain,
    countryCode,
    countryName,
    compCode,
    compName,
    birthYear,
}: {
    row: CardRow
    domain: [number, number]
    countryCode: string
    countryName: string
    compCode: string
    compName: string
    birthYear: number
}) {
    const meta = row.meta
    const showComp = row.compNow !== null && countryCode !== compCode
    // open the chart on the line tab, with the country + comparison entity selected
    const selected = [...new Set([countryCode, compCode])].join("~")
    const chartUrl =
        `https://ourworldindata.org/grapher/${meta.slug}` +
        `?tab=line&time=${birthYear}..latest&country=${selected}`
    const hasTip = !!(meta.desc || meta.unit || meta.source)

    return (
        <div className="your-life-in-data__row">
            <div>
                <div className="your-life-in-data__row-label">
                    <a
                        className="your-life-in-data__metric"
                        href={chartUrl}
                        target="_blank"
                        rel="noopener"
                    >
                        {meta.label}
                        {hasTip && (
                            <span className="your-life-in-data__metric-tip">
                                {meta.desc}
                                {meta.unit && (
                                    <span className="your-life-in-data__metric-tip-unit">
                                        Unit: {meta.unit}
                                    </span>
                                )}
                                {meta.source && (
                                    <span className="your-life-in-data__metric-tip-source">
                                        Source: {meta.source}
                                    </span>
                                )}
                            </span>
                        )}
                    </a>
                </div>
                <div
                    className={cx(
                        "your-life-in-data__phrase",
                        `your-life-in-data__phrase--${row.tone}`
                    )}
                >
                    {row.phrase}
                </div>
            </div>
            <div className="your-life-in-data__then">
                <div className="your-life-in-data__value">
                    {formatValue(row.then, meta.format)}
                </div>
                {showComp && (
                    <div className="your-life-in-data__comp-value">
                        {formatValue(row.compThen, meta.format)}
                    </div>
                )}
            </div>
            <Sparkline
                row={row}
                domain={domain}
                countryName={countryName}
                compName={compName}
            />
            <div className="your-life-in-data__now">
                <div className="your-life-in-data__value">
                    {formatValue(row.now, meta.format)}
                </div>
                {showComp && (
                    <div className="your-life-in-data__comp-value">
                        {formatValue(row.compNow, meta.format)}
                    </div>
                )}
            </div>
        </div>
    )
}
