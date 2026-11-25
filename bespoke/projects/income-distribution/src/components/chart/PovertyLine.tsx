import { useCallback, useMemo, useRef, useState } from "react"
import cx from "clsx"
import * as R from "remeda"
import type { ScaleLogarithmic } from "d3-scale"

import { Bounds } from "@ourworldindata/utils"
import {
    GRAPHER_BACKGROUND,
    GRAPHER_DARK_TEXT,
    GRAY_100,
    GRAY_60,
    GRAY_70,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

import { INT_POVERTY_LINE, INTERNATIONAL_DOLLAR } from "../../core/constants.js"
import { formatIncome, timeIntervalNoun } from "../../core/currency.js"
import type { LabelBox } from "../../core/curveLabels.js"
import {
    layoutPovertyLineLabel,
    POVERTY_LINE_LABEL,
} from "../../core/povertyLineLabel.js"
import type { Currency, TimeInterval } from "../../core/types.js"

/** Arrow keys move the poverty line by this factor on the log axis; with Shift by the larger one */
const KEYBOARD_STEP = 1.05
const KEYBOARD_STEP_LARGE = 1.25

/** A point relative to the chart container, in px */
export interface Position {
    x: number
    y: number
}

/** What the poverty line's label says, for the line at `income` (int-$/day) */
export interface PovertyLineText {
    income: number
    /** Bold first line; without it, `label` is the bold line */
    title?: string
    label: string
    /** A lighter, italic line below */
    hint?: string
}

/**
 * "$3 a day", plus the same amount in the chart's units when those differ,
 * e.g. "$3 a day or €79 per month"
 */
export function internationalPovertyLineAmount(
    currency: Currency,
    timeInterval: TimeInterval
): string {
    const perDay = `$${INT_POVERTY_LINE} a day`
    if (currency.code === INTERNATIONAL_DOLLAR.code && timeInterval === "daily")
        return perDay
    const converted = formatIncome(INT_POVERTY_LINE, currency, timeInterval, {
        short: true,
    })
    return `${perDay} or ${converted} per ${timeIntervalNoun(timeInterval)}`
}

export interface PovertyLineHandlers {
    onPointerDown: (event: React.PointerEvent<SVGGElement>) => void
    onPointerMove: (event: React.PointerEvent<SVGGElement>) => void
    onPointerUp: (event: React.PointerEvent<SVGGElement>) => void
    onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => void
}

/**
 * Moving the poverty line: dragging it (the line captures the pointer), the
 * arrow keys once it's focused, and Delete or Backspace to remove it. Also
 * keeps the position of the ×'s hint while the × is hovered or focused.
 */
export function usePovertyLineInteraction({
    povertyLine,
    povertyLineText,
    xScale,
    incomeAtEvent,
    onSetPovertyLine,
    onClearPovertyLine,
    onDragStart,
}: {
    povertyLine: number | null
    povertyLineText: PovertyLineText | null
    xScale: ScaleLogarithmic<number, number>
    /** The income under a pointer event, or null before the chart is mounted */
    incomeAtEvent: (event: {
        clientX: number
        clientY: number
    }) => number | null
    onSetPovertyLine: (income: number) => void
    onClearPovertyLine: (() => void) | undefined
    /** A drag has started: the chart hides its hover line */
    onDragStart: () => void
}): {
    lineHandlers: PovertyLineHandlers
    /** Set while the line is being dragged; the chart's own hover ignores moves then */
    isDraggingRef: React.RefObject<boolean>
    /**
     * The line's text where a drag started, until the drag ends: the country
     * labels keep clear of that, rather than following the line, which would
     * make them flicker in and out as it passes over them
     */
    dragStartLine: PovertyLineText | null
    /** Where the ×'s hint goes while the × is hovered or focused */
    clearHintAt: Position | null
    setClearHintAt: (position: Position | null) => void
    /** Removes the line and its hint; undefined when the line can't be removed */
    clearPovertyLine: (() => void) | undefined
} {
    const isDraggingRef = useRef(false)
    const [dragStartLine, setDragStartLine] = useState<PovertyLineText | null>(
        null
    )
    const [clearHintAt, setClearHintAt] = useState<Position | null>(null)

    const [minIncome, maxIncome] = xScale.domain()
    const clampIncome = useCallback(
        (income: number) => R.clamp(income, { min: minIncome, max: maxIncome }),
        [minIncome, maxIncome]
    )
    const onPointerDown = useCallback(
        (event: React.PointerEvent<SVGGElement>) => {
            // Grabbing the line moves it; it mustn't also count as a click on the plot
            event.stopPropagation()
            event.currentTarget.setPointerCapture(event.pointerId)
            isDraggingRef.current = true
            setDragStartLine(povertyLineText)
            onDragStart()
        },
        [povertyLineText, onDragStart]
    )
    const onPointerMove = useCallback(
        (event: React.PointerEvent<SVGGElement>) => {
            if (!isDraggingRef.current) return
            event.stopPropagation()
            const income = incomeAtEvent(event)
            if (income !== null) onSetPovertyLine(clampIncome(income))
        },
        [incomeAtEvent, onSetPovertyLine, clampIncome]
    )
    const onPointerUp = useCallback(
        (event: React.PointerEvent<SVGGElement>) => {
            if (!isDraggingRef.current) return
            isDraggingRef.current = false
            setDragStartLine(null)
            event.currentTarget.releasePointerCapture(event.pointerId)
        },
        []
    )
    const onKeyDown = useCallback(
        (event: React.KeyboardEvent<SVGGElement>) => {
            if (povertyLine === null) return
            if (
                (event.key === "Delete" || event.key === "Backspace") &&
                onClearPovertyLine
            ) {
                event.preventDefault()
                onClearPovertyLine()
                return
            }
            const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP
            const next =
                event.key === "ArrowRight" || event.key === "ArrowUp"
                    ? povertyLine * step
                    : event.key === "ArrowLeft" || event.key === "ArrowDown"
                      ? povertyLine / step
                      : null
            if (next === null) return
            event.preventDefault()
            onSetPovertyLine(clampIncome(next))
        },
        [povertyLine, onSetPovertyLine, onClearPovertyLine, clampIncome]
    )
    const clearPovertyLine = useMemo(
        () =>
            onClearPovertyLine &&
            ((): void => {
                setClearHintAt(null)
                onClearPovertyLine()
            }),
        [onClearPovertyLine]
    )

    return {
        lineHandlers: { onPointerDown, onPointerMove, onPointerUp, onKeyDown },
        isDraggingRef,
        dragStartLine,
        clearHintAt,
        setClearHintAt,
        clearPovertyLine,
    }
}

/**
 * The poverty line, drawn like a pin: a dashed line topped by a ball, with
 * its label beside the ball and a × that removes the line. The line and the
 * ball are the grab target: drag to move the line, or focus it and use the
 * arrow keys.
 */
export function PovertyLine({
    x,
    plotTop,
    plotBottom,
    width,
    obstacles,
    title,
    label,
    hint,
    isFixed = false,
    valueNow,
    valueMin,
    valueMax,
    handlers,
    onClear,
    onClearHintChange,
}: {
    x: number
    plotTop: number
    plotBottom: number
    width: number
    /** Boxes the label stays clear of by moving left of the ball */
    obstacles?: LabelBox[]
    /** Bold first line; without it, `label` is the bold line */
    title?: string
    label: string
    /** A lighter, italic line below */
    hint?: string
    /** Can't be dragged or moved by key */
    isFixed?: boolean
    /** Int-$/day, for assistive tech */
    valueNow: number
    valueMin: number
    valueMax: number
    /** From usePovertyLineInteraction */
    handlers: PovertyLineHandlers
    /** Without it, the line has no × */
    onClear?: () => void
    /** Where the × is while it's hovered or focused, for its hint; null after */
    onClearHintChange: (position: Position | null) => void
}): React.ReactElement {
    const { fontSize, ballRadius, clearSize, lineHeight } = POVERTY_LINE_LABEL
    const ballY = plotTop
    // The label sits right of the ball, or left of it when it would overflow
    // or run into an obstacle (e.g. the button over the plot's corner)
    const { fitsRight, textX, clearCenterX } = layoutPovertyLineLabel({
        x,
        ballY,
        width,
        title,
        label,
        hint,
        hasClear: !!onClear,
        // The international line's two-line label goes left when it fits
        preferLeft: title !== undefined,
        obstacles,
    })
    const clearHintPosition = { x: clearCenterX, y: ballY + clearSize / 2 + 4 }

    return (
        <g>
            <g
                className={cx("income-distribution-chart__poverty-line", {
                    "income-distribution-chart__poverty-line--fixed": isFixed,
                })}
                onClick={(event) => event.stopPropagation()}
                {...(isFixed
                    ? {
                          role: "img",
                          "aria-label": title ? `${title}, ${label}` : label,
                      }
                    : {
                          role: "slider",
                          tabIndex: 0,
                          "aria-label": "Poverty line",
                          "aria-valuenow": valueNow,
                          "aria-valuemin": valueMin,
                          "aria-valuemax": valueMax,
                          "aria-valuetext": title
                              ? `${title}, ${label}`
                              : label,
                          "aria-orientation": "horizontal",
                          onPointerDown: handlers.onPointerDown,
                          onPointerMove: handlers.onPointerMove,
                          onPointerUp: handlers.onPointerUp,
                          onPointerCancel: handlers.onPointerUp,
                          onKeyDown: handlers.onKeyDown,
                      })}
            >
                {/* A wide invisible line, so the dashed one is easy to grab */}
                <line
                    x1={x}
                    x2={x}
                    y1={plotTop}
                    y2={plotBottom}
                    stroke="transparent"
                    strokeWidth={16}
                />
                <line
                    x1={x}
                    x2={x}
                    y1={plotTop}
                    y2={plotBottom}
                    stroke={GRAY_100}
                    strokeWidth={2}
                    strokeDasharray="5,4"
                    pointerEvents="none"
                />
                <circle
                    className="income-distribution-chart__poverty-line-ball"
                    cx={x}
                    cy={ballY}
                    r={ballRadius}
                    fill={GRAY_100}
                    stroke={GRAPHER_BACKGROUND}
                    strokeWidth={1.5}
                />
                <text
                    x={textX}
                    y={ballY}
                    dominantBaseline="central"
                    textAnchor={fitsRight ? "start" : "end"}
                    fontSize={fontSize}
                    fontWeight={700}
                    fill={GRAY_100}
                    stroke={GRAPHER_BACKGROUND}
                    strokeWidth={3}
                    paintOrder="stroke"
                    pointerEvents="none"
                >
                    {title ?? label}
                </text>
                {title && (
                    <text
                        x={textX}
                        y={ballY + lineHeight}
                        dominantBaseline="central"
                        textAnchor={fitsRight ? "start" : "end"}
                        fontSize={fontSize}
                        fill={GRAY_100}
                        stroke={GRAPHER_BACKGROUND}
                        strokeWidth={3}
                        paintOrder="stroke"
                        pointerEvents="none"
                    >
                        {label}
                    </text>
                )}
                {hint && (
                    <text
                        x={textX}
                        y={ballY + (title ? 2 : 1) * lineHeight}
                        dominantBaseline="central"
                        textAnchor={fitsRight ? "start" : "end"}
                        fontSize={fontSize}
                        fontStyle="italic"
                        fill={GRAY_70}
                        stroke={GRAPHER_BACKGROUND}
                        strokeWidth={3}
                        paintOrder="stroke"
                        pointerEvents="none"
                    >
                        {hint}
                    </text>
                )}
            </g>
            {onClear && (
                <g
                    className="income-distribution-chart__poverty-line-clear"
                    role="button"
                    tabIndex={0}
                    aria-label="Remove poverty line"
                    // Keep the press from reaching the plot, which would set the line again
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerEnter={() => onClearHintChange(clearHintPosition)}
                    onPointerLeave={() => onClearHintChange(null)}
                    onFocus={() => onClearHintChange(clearHintPosition)}
                    onBlur={() => onClearHintChange(null)}
                    onClick={(event) => {
                        event.stopPropagation()
                        onClear()
                    }}
                    onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return
                        event.preventDefault()
                        onClear()
                    }}
                >
                    <circle
                        className="income-distribution-chart__poverty-line-clear-bg"
                        cx={clearCenterX}
                        cy={ballY}
                        r={clearSize / 2}
                    />
                    <path
                        d={`M ${clearCenterX - 3} ${ballY - 3} l 6 6 m 0 -6 l -6 6`}
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        pointerEvents="none"
                    />
                </g>
            )}
        </g>
    )
}

/** The hover line where a click would put the poverty line, with the income under the axis */
export function PointerLine({
    x,
    plotTop,
    plotBottom,
    width,
    fontSize,
    label,
}: {
    x: number
    plotTop: number
    plotBottom: number
    width: number
    fontSize: number
    label: string
}): React.ReactElement {
    // Keep the label inside the chart near its edges
    const halfLabelWidth =
        Bounds.forText(label, { fontSize, fontWeight: 700 }).width / 2
    const labelX = Math.min(
        Math.max(x, halfLabelWidth),
        Math.max(width - halfLabelWidth, halfLabelWidth)
    )
    return (
        <g pointerEvents="none">
            <line
                x1={x}
                x2={x}
                y1={plotTop}
                y2={plotBottom}
                stroke={GRAY_60}
                strokeWidth={1}
            />
            <text
                x={labelX}
                y={plotBottom + 9}
                dy="0.71em"
                textAnchor="middle"
                fontSize={fontSize}
                fontWeight={700}
                fill={GRAPHER_DARK_TEXT}
                stroke={GRAPHER_BACKGROUND}
                strokeWidth={4}
                paintOrder="stroke"
            >
                {label}
            </text>
        </g>
    )
}
