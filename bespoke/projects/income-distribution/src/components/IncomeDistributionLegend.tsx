import { useMemo } from "react"
import cx from "clsx"
import * as R from "remeda"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faXmark } from "@fortawesome/free-solid-svg-icons"

import {
    formatIncome,
    formatShare,
    timeIntervalNoun,
} from "../core/currency.js"
import { WORLD_ENTITY_NAME } from "../core/constants.js"
import type { Currency, TimeInterval } from "../core/types.js"
import { formatLegendLabel } from "../core/legendLabels.js"

/** Length in px of a 100% bar in the overlay legend */
const OVERLAY_BAR_MAX_WIDTH = 100
/** The shortest bar, so a share near zero still shows its colour */
const OVERLAY_BAR_MIN_WIDTH = 2

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
    /**
     * "inline" sits above the plot and turns into a list of share bars when
     * a poverty line is set. "overlay" floats over the plot's top-right
     * corner, where each colour square grows into a bar of the share below
     * the line, and an × replaces the "Clear" link
     */
    layout?: "inline" | "overlay"
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
    layout = "inline",
}: IncomeDistributionLegendProps): React.ReactElement {
    const shares = povertyLine !== null ? sharesBelowLine : undefined

    // Rows render in the stable `entries` order and are ranked with CSS
    // `order`: re-sorting the DOM would move nodes, which cancels a bar's
    // running width transition and makes it snap
    const rankOf = useMemo(() => {
        if (!shares) return undefined
        const ranked = R.sortBy(entries, [
            (entry) => shares.get(entry.key) ?? -1,
            "desc",
        ])
        return new Map(ranked.map((entry, rank) => [entry.key, rank]))
    }, [entries, shares])

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

    const shareHeading =
        povertyLine !== null ? (
            <>
                Share of population living on less than{" "}
                {formatIncome(povertyLine, currency, timeInterval, {
                    short: true,
                })}{" "}
                a {timeIntervalNoun(timeInterval)}:
            </>
        ) : null

    if (layout === "overlay") {
        const showShares = shares !== undefined && povertyLine !== null
        return (
            <div
                className={cx(
                    "income-distribution-legend",
                    "income-distribution-legend--overlay",
                    { "income-distribution-legend--overlay-shares": showShares }
                )}
            >
                {showShares && (
                    <div className="income-distribution-legend__header">
                        {shareHeading}
                    </div>
                )}
                {showShares && onClearPovertyLine && (
                    <button
                        type="button"
                        className="income-distribution-legend__close"
                        onClick={onClearPovertyLine}
                        aria-label="Remove poverty line"
                        data-hint="Remove poverty line"
                    >
                        <FontAwesomeIcon icon={faXmark} aria-hidden />
                    </button>
                )}
                <ul className="income-distribution-legend__rows">
                    {entries.map((entry) => {
                        const share = showShares
                            ? shares.get(entry.key)
                            : undefined
                        return (
                            <li
                                key={entry.key}
                                className={entryClassName(entry)}
                                style={{ order: rankOf?.get(entry.key) }}
                                {...pointerHandlers(entry.key)}
                            >
                                <span className="income-distribution-legend__mark">
                                    {showShares && (
                                        <span className="income-distribution-legend__value">
                                            {share !== undefined
                                                ? formatShare(share)
                                                : "–"}
                                        </span>
                                    )}
                                    {/* The swatch is the bar: it grows from a square to the share's length */}
                                    <span
                                        className="income-distribution-legend__swatch"
                                        style={{
                                            backgroundColor: entry.color,
                                            width: showShares
                                                ? R.clamp(
                                                      (share ?? 0) *
                                                          OVERLAY_BAR_MAX_WIDTH,
                                                      {
                                                          min: OVERLAY_BAR_MIN_WIDTH,
                                                          max: OVERLAY_BAR_MAX_WIDTH,
                                                      }
                                                  )
                                                : undefined,
                                        }}
                                    />
                                </span>
                                <span className="income-distribution-legend__label">
                                    {formatLegendLabel(
                                        entry.label ?? entry.key
                                    )}
                                </span>
                            </li>
                        )
                    })}
                </ul>
            </div>
        )
    }

    if (shares === undefined || povertyLine === null) {
        return (
            <ul
                className={cx(
                    "income-distribution-legend",
                    "income-distribution-legend--swatches",
                    { "income-distribution-legend--narrow": isNarrow }
                )}
            >
                {entries.map((entry) => (
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
                            {formatLegendLabel(entry.label ?? entry.key)}
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
                <span>{shareHeading}</span>
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
                {entries.map((entry) => {
                    const share = shares.get(entry.key)
                    return (
                        <li
                            key={entry.key}
                            className={entryClassName(entry)}
                            style={{ order: rankOf?.get(entry.key) }}
                            {...pointerHandlers(entry.key)}
                        >
                            <span className="income-distribution-legend__label">
                                {formatLegendLabel(entry.label ?? entry.key)}
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
