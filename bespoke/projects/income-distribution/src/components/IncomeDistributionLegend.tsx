import { Fragment, useMemo } from "react"
import cx from "clsx"
import * as R from "remeda"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faXmark } from "@fortawesome/free-solid-svg-icons"

import {
    formatIncome,
    formatPeople,
    formatShare,
    timeIntervalNoun,
} from "../core/currency.js"
import { SHORT_REGION_NAMES, WORLD_ENTITY_NAME } from "../core/constants.js"
import {
    LEGEND_MEASURES,
    WELFARE_TYPES,
    type Currency,
    type LegendMeasure,
    type TimeInterval,
    type WelfareType,
} from "../core/types.js"
import { WELFARE_TYPE_BADGES } from "../core/welfareType.js"
import { formatLegendLabel, legendLabelLines } from "../core/legendLabels.js"
import { WelfareBadge } from "./WelfareBadge.js"

/** Length in px of a 100% bar in the overlay legend */
const OVERLAY_BAR_MAX_WIDTH = 100
/**
 * Length in px of the longest bar in the overlay legend's number-of-people
 * mode: shorter than a 100% share's, so with a wider value like "820 million"
 * the box keeps about the same width when the measure switches
 */
const OVERLAY_PEOPLE_BAR_MAX_WIDTH = 72
/** The shortest bar, so a share near zero still shows its colour */
const OVERLAY_BAR_MIN_WIDTH = 2

const MEASURE_LABELS: Record<LegendMeasure, string> = {
    share: "Share of population",
    people: "Number of people",
}

export interface LegendEntry {
    key: string
    /** Display name; defaults to `key` */
    label?: string
    color: string
    /** Countries only: shown as a badge after the name */
    welfareType?: WelfareType
}

export interface IncomeDistributionLegendProps {
    entries: LegendEntry[]
    hoveredEntity: string | null
    onHoverEntity: (key: string | null) => void
    /**
     * Hovered in the key the legend ends with when its entries have welfare
     * types: the entries of that type stay full and the rest dim
     */
    hoveredWelfareType?: WelfareType | null
    onHoverWelfareType?: (type: WelfareType | null) => void
    /**
     * When set, each entry shows its share of population below the line, and
     * entries sort by it descending; World is appended by the caller
     */
    sharesBelowLine?: Map<string, number>
    /**
     * What the bars show when a poverty line is set: the share of each
     * entry's population below it, or the number of people (from
     * `peopleBelowLine`, falling back to the shares while that's missing)
     */
    measure?: LegendMeasure
    /** When set, the heading starts with a switch between the two measures */
    onMeasureChange?: (measure: LegendMeasure) => void
    peopleBelowLine?: Map<string, number>
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
    hoveredWelfareType = null,
    onHoverWelfareType,
    sharesBelowLine,
    measure = "share",
    onMeasureChange,
    peopleBelowLine,
    povertyLine,
    currency,
    timeInterval,
    onClearPovertyLine,
    isNarrow,
    layout = "inline",
}: IncomeDistributionLegendProps): React.ReactElement {
    const shares = povertyLine !== null ? sharesBelowLine : undefined
    const showPeople =
        shares !== undefined &&
        measure === "people" &&
        peopleBelowLine !== undefined
    // What the bars show, and what the rows are ranked by
    const values = showPeople ? peopleBelowLine : shares

    // Rows render in the stable `entries` order and are ranked with CSS
    // `order`: re-sorting the DOM would move nodes, which cancels a bar's
    // running width transition and makes it snap
    const rankOf = useMemo(() => {
        if (!values) return undefined
        const ranked = R.sortBy(entries, [
            (entry) => values.get(entry.key) ?? -1,
            "desc",
        ])
        return new Map(ranked.map((entry, rank) => [entry.key, rank]))
    }, [entries, values])

    // Counts are scaled to the largest one shown, usually the World's
    const maxPeople = useMemo(
        () =>
            showPeople
                ? Math.max(
                      ...entries.map(
                          (entry) => peopleBelowLine.get(entry.key) ?? 0
                      ),
                      1
                  )
                : 1,
        [showPeople, entries, peopleBelowLine]
    )
    /** An entry's bar length as a fraction (0–1) of the longest possible one */
    const barFraction = (key: string): number =>
        R.clamp(
            showPeople
                ? (peopleBelowLine.get(key) ?? 0) / maxPeople
                : (shares?.get(key) ?? 0),
            { min: 0, max: 1 }
        )
    const formatValue = (key: string): string => {
        const value = values?.get(key)
        if (value === undefined) return "–"
        return showPeople ? formatPeople(value) : formatShare(value)
    }

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
                (hasHoveredEntry && entry.key !== hoveredEntity) ||
                (hoveredWelfareType !== null &&
                    entry.welfareType !== hoveredWelfareType),
        })

    // The key to the badges, listing only the types some entry has, so a key
    // entry never points at nothing
    const keyTypes = WELFARE_TYPES.filter((type) =>
        entries.some((entry) => entry.welfareType === type)
    )
    const keyEntryProps = (
        type: WelfareType
    ): Pick<
        React.HTMLAttributes<HTMLElement>,
        "onPointerEnter" | "onPointerLeave" | "onFocus" | "onBlur"
    > => ({
        onPointerEnter: (event) => {
            if (event.pointerType === "mouse") onHoverWelfareType?.(type)
        },
        onPointerLeave: (event) => {
            if (event.pointerType === "mouse") onHoverWelfareType?.(null)
        },
        // The badge inside is focusable
        onFocus: () => onHoverWelfareType?.(type),
        onBlur: () => onHoverWelfareType?.(null),
    })
    const keyEntryClassName = (type: WelfareType, first: boolean): string =>
        cx("income-distribution-legend__key-entry", {
            "income-distribution-legend__key-entry--first": first,
            "income-distribution-legend__key-entry--dimmed":
                hoveredWelfareType !== null && type !== hoveredWelfareType,
        })
    // Inline layouts: one row of key entries after the list's own rows
    const inlineKey =
        keyTypes.length > 0 ? (
            <li className="income-distribution-legend__key">
                {keyTypes.map((type) => (
                    <span
                        key={type}
                        className={keyEntryClassName(type, false)}
                        {...keyEntryProps(type)}
                    >
                        <WelfareBadge welfareType={type} />
                        <span className="income-distribution-legend__key-label">
                            {WELFARE_TYPE_BADGES[type].title}
                        </span>
                    </span>
                ))}
            </li>
        ) : null

    const lineText =
        povertyLine !== null ? (
            <>
                living on less than{" "}
                {formatIncome(povertyLine, currency, timeInterval, {
                    short: true,
                })}{" "}
                a {timeIntervalNoun(timeInterval)}
            </>
        ) : null
    // With a switch, the heading's start is the control: "Share of population
    // | Number of people", then "living on less than…" on the next line
    const shareHeading = onMeasureChange ? (
        <>
            <span
                className="income-distribution-legend__measure"
                role="group"
                aria-label="Show in the bars"
            >
                {LEGEND_MEASURES.map((key, i) => (
                    <Fragment key={key}>
                        {i > 0 && (
                            <span
                                className="income-distribution-legend__measure-divider"
                                aria-hidden
                            />
                        )}
                        <button
                            type="button"
                            className="income-distribution-legend__measure-option"
                            aria-pressed={measure === key}
                            onClick={() => onMeasureChange(key)}
                        >
                            {MEASURE_LABELS[key]}
                        </button>
                    </Fragment>
                ))}
            </span>
            {lineText}
        </>
    ) : (
        <>
            {MEASURE_LABELS.share} {lineText}:
        </>
    )

    if (layout === "overlay") {
        const showShares = shares !== undefined && povertyLine !== null
        return (
            <div
                className={cx(
                    "income-distribution-legend",
                    "income-distribution-legend--overlay",
                    {
                        "income-distribution-legend--overlay-shares":
                            showShares,
                        "income-distribution-legend--people": showPeople,
                    }
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
                        // With the bars, names keep to one line, so long
                        // ones are shortened
                        const shortName = showShares
                            ? SHORT_REGION_NAMES.get(entry.key)
                            : undefined
                        const labelLines = shortName
                            ? [shortName]
                            : legendLabelLines(entry.label ?? entry.key)
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
                                            {formatValue(entry.key)}
                                        </span>
                                    )}
                                    {/* The swatch is the bar: it grows from a square to the value's length */}
                                    <span
                                        className="income-distribution-legend__swatch"
                                        style={{
                                            backgroundColor: entry.color,
                                            width: showShares
                                                ? Math.max(
                                                      barFraction(entry.key) *
                                                          (showPeople
                                                              ? OVERLAY_PEOPLE_BAR_MAX_WIDTH
                                                              : OVERLAY_BAR_MAX_WIDTH),
                                                      OVERLAY_BAR_MIN_WIDTH
                                                  )
                                                : undefined,
                                        }}
                                    />
                                </span>
                                <span
                                    className="income-distribution-legend__label"
                                    title={
                                        shortName
                                            ? (entry.label ?? entry.key)
                                            : undefined
                                    }
                                >
                                    {/* One block per preferred line, so a
                                        broken label is only as wide as its
                                        longest line and the rows, which set
                                        the box's width, stay narrow */}
                                    {labelLines.map((line, i, lines) => (
                                        <span
                                            key={line}
                                            className="income-distribution-legend__label-line"
                                        >
                                            {line}
                                            {/* After the last line's last word */}
                                            {i === lines.length - 1 &&
                                                entry.welfareType && (
                                                    <WelfareBadge
                                                        welfareType={
                                                            entry.welfareType
                                                        }
                                                    />
                                                )}
                                        </span>
                                    ))}
                                </span>
                            </li>
                        )
                    })}
                    {/* The key's rows line their badges up with the swatches */}
                    {keyTypes.map((type, i) => (
                        <li
                            key={type}
                            className={keyEntryClassName(type, i === 0)}
                            {...keyEntryProps(type)}
                        >
                            <span className="income-distribution-legend__mark">
                                <WelfareBadge welfareType={type} />
                            </span>
                            <span className="income-distribution-legend__key-label">
                                {WELFARE_TYPE_BADGES[type].title}
                            </span>
                        </li>
                    ))}
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
                        {entry.welfareType && (
                            <WelfareBadge welfareType={entry.welfareType} />
                        )}
                    </li>
                ))}
                {inlineKey}
            </ul>
        )
    }

    return (
        <div
            className={cx(
                "income-distribution-legend",
                "income-distribution-legend--shares",
                {
                    "income-distribution-legend--narrow": isNarrow,
                    "income-distribution-legend--people": showPeople,
                }
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
                    return (
                        <li
                            key={entry.key}
                            className={entryClassName(entry)}
                            style={{ order: rankOf?.get(entry.key) }}
                            {...pointerHandlers(entry.key)}
                        >
                            <span className="income-distribution-legend__label">
                                {formatLegendLabel(entry.label ?? entry.key)}
                                {entry.welfareType && (
                                    <WelfareBadge
                                        welfareType={entry.welfareType}
                                    />
                                )}
                            </span>
                            <span className="income-distribution-legend__bar-cell">
                                <span className="income-distribution-legend__bar-track">
                                    <span
                                        className="income-distribution-legend__bar"
                                        style={{
                                            backgroundColor: entry.color,
                                            width: `${barFraction(entry.key) * 100}%`,
                                        }}
                                    />
                                </span>
                                <span className="income-distribution-legend__value">
                                    {formatValue(entry.key)}
                                </span>
                            </span>
                        </li>
                    )
                })}
                {inlineKey}
            </ul>
        </div>
    )
}
