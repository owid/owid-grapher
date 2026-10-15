import { useMemo } from "react"
import cx from "clsx"
import * as R from "remeda"

import {
    formatIncome,
    formatShare,
    timeIntervalNoun,
} from "../core/currency.js"
import { WORLD_ENTITY_NAME } from "../core/constants.js"
import type { Currency, TimeInterval } from "../core/types.js"

export interface LegendEntry {
    key: string
    /** Display name; defaults to `key` */
    label?: string
    color: string
}

export interface IncomeDistributionLegendProps {
    entries: LegendEntry[]
    hoveredEntity: string | null
    onHoverEntity: (key: string | null) => void
    /**
     * When set, each entry shows its share of population below the line, and
     * entries sort by it descending; World is appended by the caller
     */
    sharesBelowLine?: Map<string, number>
    povertyLine: number | null
    currency: Currency
    timeInterval: TimeInterval
    onClearPovertyLine?: () => void
    isNarrow: boolean
}

export function IncomeDistributionLegend({
    entries,
    hoveredEntity,
    onHoverEntity,
    sharesBelowLine,
    povertyLine,
    currency,
    timeInterval,
    onClearPovertyLine,
    isNarrow,
}: IncomeDistributionLegendProps): React.ReactElement {
    const shares = povertyLine !== null ? sharesBelowLine : undefined

    const sortedEntries = useMemo(
        () =>
            shares
                ? R.sortBy(entries, [
                      (entry) => shares.get(entry.key) ?? -1,
                      "desc",
                  ])
                : entries,
        [entries, shares]
    )

    // Only dim when the hovered entity is one of ours; a hovered country in
    // the region legend leaves the legend as it is
    const hasHoveredEntry =
        hoveredEntity !== null &&
        entries.some((entry) => entry.key === hoveredEntity)

    const pointerHandlers = (
        key: string
    ): Pick<
        React.HTMLAttributes<HTMLElement>,
        "onPointerEnter" | "onPointerLeave"
    > => ({
        onPointerEnter: (event) => {
            if (event.pointerType === "mouse") onHoverEntity(key)
        },
        onPointerLeave: (event) => {
            if (event.pointerType === "mouse") onHoverEntity(null)
        },
    })

    const entryClassName = (entry: LegendEntry): string =>
        cx("income-distribution-legend__entry", {
            "income-distribution-legend__entry--world":
                entry.key === WORLD_ENTITY_NAME,
            "income-distribution-legend__entry--dimmed":
                hasHoveredEntry && entry.key !== hoveredEntity,
        })

    if (shares === undefined || povertyLine === null) {
        return (
            <ul
                className={cx(
                    "income-distribution-legend",
                    "income-distribution-legend--swatches",
                    { "income-distribution-legend--narrow": isNarrow }
                )}
            >
                {sortedEntries.map((entry) => (
                    <li
                        key={entry.key}
                        className={entryClassName(entry)}
                        {...pointerHandlers(entry.key)}
                    >
                        <span
                            className="income-distribution-legend__swatch"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="income-distribution-legend__label">
                            {entry.label ?? entry.key}
                        </span>
                    </li>
                ))}
            </ul>
        )
    }

    return (
        <div
            className={cx(
                "income-distribution-legend",
                "income-distribution-legend--shares",
                { "income-distribution-legend--narrow": isNarrow }
            )}
        >
            <div className="income-distribution-legend__header">
                <span>
                    Share of population living on less than{" "}
                    {formatIncome(povertyLine, currency, timeInterval)} a{" "}
                    {timeIntervalNoun(timeInterval)}:
                </span>
                {onClearPovertyLine && (
                    <button
                        type="button"
                        className="income-distribution-legend__clear"
                        onClick={onClearPovertyLine}
                    >
                        Clear
                    </button>
                )}
            </div>
            <ul className="income-distribution-legend__bars">
                {sortedEntries.map((entry) => {
                    const share = shares.get(entry.key)
                    return (
                        <li
                            key={entry.key}
                            className={entryClassName(entry)}
                            {...pointerHandlers(entry.key)}
                        >
                            <span className="income-distribution-legend__label">
                                {entry.label ?? entry.key}
                            </span>
                            <span className="income-distribution-legend__bar-cell">
                                <span className="income-distribution-legend__bar-track">
                                    <span
                                        className="income-distribution-legend__bar"
                                        style={{
                                            backgroundColor: entry.color,
                                            width: `${R.clamp((share ?? 0) * 100, { min: 0, max: 100 })}%`,
                                        }}
                                    />
                                </span>
                                <span className="income-distribution-legend__value">
                                    {share !== undefined
                                        ? formatShare(share)
                                        : "–"}
                                </span>
                            </span>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
