import {
    Fragment,
    memo,
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react"
import cx from "clsx"
import * as R from "remeda"
import { scaleLinear, scaleLog } from "@visx/scale"
import { area, curveMonotoneX, line } from "d3-shape"
import type { ScaleLinear, ScaleLogarithmic } from "d3-scale"

import { Bounds, getRelativeMouse } from "@ourworldindata/utils"
import {
    GRAPHER_BACKGROUND,
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
    GRAY_100,
    GRAY_20,
    GRAY_60,
    GRAY_70,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { darkenColorForText } from "@ourworldindata/grapher/src/color/ColorUtils.js"
import { BezierArrow } from "@ourworldindata/grapher/src/arrows/BezierArrow.js"

import { ResponsiveContainer } from "../../../../components/ResponsiveContainer/ResponsiveContainer.js"
import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import type {
    ChartSeries,
    IncomeDistributionChartModel,
} from "../core/chartModel.js"
import {
    combinedFactor,
    formatCurrencyLabel,
    formatIncome,
    isCurrencyWrittenAsCode,
    timeIntervalNoun,
} from "../core/currency.js"
import {
    hideLabelsUnderBox,
    placeCurveLabels,
    type CurveLabelCandidate,
    type CurveLabelLayout,
    type LabelBox,
} from "../core/curveLabels.js"
import { placeRegionLabels, RegionBandPixels } from "../core/regionLabels.js"
import {
    layoutPovertyLineLabel,
    POVERTY_LINE_LABEL,
} from "../core/povertyLineLabel.js"
import type {
    Currency,
    IncomeDistributionYear,
    TimeInterval,
} from "../core/types.js"
import {
    EMPHASIS_COLOR,
    INT_POVERTY_LINE,
    INTERNATIONAL_DOLLAR,
    WORLD_COLOR,
    WORLD_ENTITY_NAME,
} from "../core/constants.js"
import { displayEntityName, displayRegionName } from "../core/legendLabels.js"
import type {
    AnnotationPlacement,
    ChartAnnotationTarget,
} from "../core/annotations.js"
import { IncomeDistributionTooltip } from "./IncomeDistributionTooltip.js"

/** Text placed relative to a point of the chart (see AnnotationPlacement) */
export interface ChartAnnotation extends AnnotationPlacement {
    key: string
    content: React.ReactNode
}

/**
 * How the chart can emphasise parts of itself, e.g. while a walkthrough
 * explains it. All off by default.
 */
export interface IncomeDistributionChartEmphasis {
    /** Draw the areas very faded, as a backdrop */
    ghostSeries?: boolean
    /** Global view: outline the top of the stack, optionally labelled at its peak */
    outlineTotal?: { label?: string }
    /** Global view, with a poverty line: fill the whole stack below the line */
    fillBelowLine?: boolean
    /** Label the regions in their bands, or the countries above their curves; default true */
    showSeriesLabels?: boolean
    /** Labels at either end of the x axis, e.g. "Poorest" and "Richest" */
    axisEndLabels?: { left: string; right: string }
    annotations?: ChartAnnotation[]
    /** A lighter line under the poverty line's label, e.g. how to move it */
    povertyLineHint?: string
    /** The line can't be dragged or moved by key; default false */
    isPovertyLineFixed?: boolean
    /**
     * Whether hovering shows the tooltip and a click sets the line; default
     * true. Dragging an existing line works either way.
     */
    isInteractive?: boolean
}

export interface IncomeDistributionChartProps extends IncomeDistributionChartEmphasis {
    model: IncomeDistributionChartModel
    /** For the share below the line in the tooltip */
    yearData: IncomeDistributionYear
    year: number
    currency: Currency
    timeInterval: TimeInterval
    /** Poverty line in int-$/day, null when unset */
    povertyLine: number | null
    /** Whether the line reads as the international poverty line in the current units */
    isInternationalPovertyLine: boolean
    /**
     * Called with the income to put the line at: on a click in the plot
     * (which sets the line, or moves it there), and while it's dragged or
     * moved with the arrow keys
     */
    onSetPovertyLine: (income: number) => void
    /** Removes the line; without it the line has no × and ignores Delete */
    onClearPovertyLine?: () => void
    /** Shared with the legend */
    hoveredEntity: string | null
    onHoverEntity: (key: string | null) => void
    isNarrow: boolean
    /**
     * Boxes over the plot (in the chart's own coordinates) that the country
     * labels and the poverty line's label keep clear of, e.g. a button
     */
    obstacles?: LabelBox[]
    /**
     * A box over the plot that the country labels keep clear of, whose
     * contents don't depend on them: the overlay legend listing every
     * country, as it does with a poverty line
     */
    legendBox?: LabelBox
    /**
     * Where the box listing the countries left without a label would start
     * (its top, in px), when there's to be one. Labels the box would cover
     * are left out too, and listed in it (see hideLabelsUnderBox).
     */
    leftoverLegendTop?: number
    /**
     * Countries view: called with the countries left without a label, in
     * series order
     */
    onUnlabelledCountriesChange?: (keys: string[]) => void
}

// The bottom holds the tick labels and, under them, the axis label, which
// takes two lines on narrow charts
const MARGIN = { top: 10, right: 16, bottom: 58, left: 16 }
const MARGIN_BOTTOM_NARROW = 72

/** Multiples of each power of ten that get a tick */
const TICK_MULTIPLIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
// In order of priority: when neighbouring labels would overlap, the later
// ones give way (the 2s go before the 3s and 5s, as they're the tightest)
const LABELLED_MULTIPLIERS = [1, 3, 5, 2]
const LABELLED_MULTIPLIERS_NARROW = [1, 3]
/** Between neighbouring tick labels */
const TICK_LABEL_GAP = 6

const REGION_LABEL_FONT_SIZES = [14, 13, 12, 11, 10, 9] as const
const REGION_LABEL_FONT_SIZES_NARROW = [13, 12, 11, 10, 9] as const

const COUNTRY_LABEL_FONT_SIZE = 12
const COUNTRY_LABEL_FONT_SIZE_NARROW = 11
const COUNTRY_LABEL_FONT_WEIGHT = 700
/** Line height of a country label as a multiple of its font size, for its box */
const COUNTRY_LABEL_LINE_HEIGHT = 1.2
/**
 * Countries view: room kept between the plot's top and the tallest peak for
 * the label above it, which mustn't run into the poverty line's label
 */
const COUNTRY_LABEL_HEADROOM = 30
/** More countries than this are labelled directly only up to it; the rest go to the legend */
const MAX_COUNTRY_LABELS = 6
const MAX_COUNTRY_LABELS_NARROW = 4
/** Country labels stay this far below the plot's top, clear of the poverty line's label */
const COUNTRY_LABEL_TOP_INSET = 9
/** Room kept between the country labels and the poverty line's label, in px */
const POVERTY_LINE_LABEL_MARGIN = 4

const FADED_OPACITY = 0.35
const DIMMED_OPACITY = 0.3
/** The areas behind an emphasised outline or fill (ghostSeries) */
const GHOST_OPACITY = 0.18

/** The outline label sits this far right of the peak, in px */
const OUTLINE_LABEL_OFFSET = 28
/** The emphasised outline draws itself in over this long when it appears */
const OUTLINE_DRAW_MS = 1500

/** A pointer that moves further than this between down and click was dragging */
const DRAG_THRESHOLD = 5

/** Arrow keys move the poverty line by this factor on the log axis; with Shift by the larger one */
const KEYBOARD_STEP = 1.05
const KEYBOARD_STEP_LARGE = 1.25

export function IncomeDistributionChart(
    props: IncomeDistributionChartProps
): React.ReactElement {
    return (
        <ResponsiveContainer>
            {(dimensions) => (
                <IncomeDistributionChartContent {...props} {...dimensions} />
            )}
        </ResponsiveContainer>
    )
}

interface Position {
    x: number
    y: number
}

interface PointerState {
    /** Int-$/day under the pointer */
    income: number
    /** Relative to the chart container */
    position: Position
}

/** What the poverty line's label says, for the line at `income` (int-$/day) */
interface PovertyLineText {
    income: number
    /** Bold first line; without it, `label` is the bold line */
    title?: string
    label: string
    /** A lighter, italic line below */
    hint?: string
}

interface AxisTick {
    /** Int-$/day, for positioning */
    value: number
    label?: string
}

function IncomeDistributionChartContent({
    model,
    yearData,
    year,
    currency,
    timeInterval,
    povertyLine,
    isInternationalPovertyLine,
    onSetPovertyLine,
    onClearPovertyLine,
    hoveredEntity,
    onHoverEntity,
    isNarrow,
    obstacles,
    legendBox,
    leftoverLegendTop,
    onUnlabelledCountriesChange,
    ghostSeries = false,
    outlineTotal,
    fillBelowLine = false,
    showSeriesLabels = true,
    axisEndLabels,
    annotations,
    povertyLineHint,
    isPovertyLineFixed = false,
    isInteractive = true,
    width,
    height,
}: IncomeDistributionChartProps & {
    width: number
    height: number
}): React.ReactElement {
    const plotLeft = MARGIN.left
    const plotRight = Math.max(width - MARGIN.right, plotLeft + 1)
    const plotTop = MARGIN.top
    const plotBottom = Math.max(
        height - (isNarrow ? MARGIN_BOTTOM_NARROW : MARGIN.bottom),
        plotTop + 1
    )
    const tickFontSize = isNarrow ? 11 : 12

    const incomes = model.grid.incomes
    const isStacked = model.regionBands.length > 0

    const xScale = useMemo(
        () =>
            scaleLog<number>({
                domain: [incomes[0], incomes[incomes.length - 1]],
                range: [plotLeft, plotRight],
                clamp: true,
            }),
        [incomes, plotLeft, plotRight]
    )
    const yScale = useMemo(
        () =>
            scaleLinear<number>({
                domain: [0, model.yMax > 0 ? model.yMax : 1],
                // Unstacked curves get room above them for their labels
                range: [
                    plotBottom,
                    isStacked
                        ? plotTop
                        : Math.min(
                              plotTop + COUNTRY_LABEL_HEADROOM,
                              plotBottom
                          ),
                ],
            }),
        [model.yMax, plotBottom, plotTop, isStacked]
    )

    const paths = useMemo(
        () => computeAreaPaths(model.series, incomes, xScale, yScale),
        [model.series, incomes, xScale, yScale]
    )

    // The top of the stack, for its outline and the fill below the line
    const totalTop = isStacked
        ? model.series[model.series.length - 1]?.y1
        : undefined
    const totalPaths = useMemo(() => {
        if (!totalTop || (!outlineTotal && !fillBelowLine)) return undefined
        const x = (_: number, i: number): number => xScale(incomes[i])
        return {
            outline:
                line<number>()
                    .x(x)
                    .y((y) => yScale(y))
                    .curve(curveMonotoneX)(totalTop) ?? "",
            area:
                area<number>()
                    .x(x)
                    .y0(yScale(0))
                    .y1((y) => yScale(y))
                    .curve(curveMonotoneX)(totalTop) ?? "",
        }
    }, [totalTop, outlineTotal, fillBelowLine, incomes, xScale, yScale])
    const totalPeak = useMemo(() => {
        if (!totalTop) return undefined
        const i = totalTop.reduce(
            (best, y, j) => (y > totalTop[best] ? j : best),
            0
        )
        return { x: xScale(incomes[i]), y: yScale(totalTop[i]) }
    }, [totalTop, incomes, xScale, yScale])

    const placedAnnotations = useMemo(
        () =>
            (annotations ?? []).map((annotation) =>
                placeAnnotation(annotation, {
                    target: annotationTargetPoint(annotation.target, {
                        povertyLine,
                        model,
                        xScale,
                        yScale,
                        plotTop,
                        plotBottom,
                    }),
                    width,
                })
            ),
        [
            annotations,
            povertyLine,
            model,
            xScale,
            yScale,
            plotTop,
            plotBottom,
            width,
        ]
    )

    const ticks = useMemo(
        () =>
            computeAxisTicks(
                xScale,
                currency,
                timeInterval,
                isNarrow ? LABELLED_MULTIPLIERS_NARROW : LABELLED_MULTIPLIERS,
                tickFontSize
            ),
        [xScale, currency, timeInterval, isNarrow, tickFontSize]
    )

    const regionLabels = useMemo(() => {
        if (model.regionBands.length === 0 || !showSeriesLabels || ghostSeries)
            return []
        const bands: RegionBandPixels[] = model.regionBands.map((band) => ({
            region: band.region,
            points: incomes.map((income, i) => ({
                x: xScale(income),
                top: yScale(band.y1[i]),
                bottom: yScale(band.y0[i]),
            })),
        }))
        return placeRegionLabels(bands, {
            fontSizes: isNarrow
                ? REGION_LABEL_FONT_SIZES_NARROW
                : REGION_LABEL_FONT_SIZES,
            // Measured rather than estimated from the character count, so
            // the label is as large as its band really allows
            measureAspect: (label) =>
                Bounds.forText(displayEntityName(label), {
                    fontSize: 16,
                    fontWeight: 700,
                }).width / 16,
        })
    }, [
        model.regionBands,
        incomes,
        xScale,
        yScale,
        isNarrow,
        showSeriesLabels,
        ghostSeries,
    ])

    // The international line is always $3 a day, whatever the chart is
    // measured in: it's named on its own line, with $3 a day and the amount in
    // the chosen units below
    const povertyLineText = useMemo(
        (): PovertyLineText | null =>
            povertyLine === null
                ? null
                : isInternationalPovertyLine
                  ? {
                        income: povertyLine,
                        title: "International poverty line",
                        label: internationalPovertyLineAmount(
                            currency,
                            timeInterval
                        ),
                    }
                  : {
                        income: povertyLine,
                        label: `Poverty line: ${formatIncome(povertyLine, currency, timeInterval, { short: true })}`,
                        hint: povertyLineHint,
                    },
        [
            povertyLine,
            isInternationalPovertyLine,
            currency,
            timeInterval,
            povertyLineHint,
        ]
    )

    // While the line is dragged, the country labels keep clear of its label
    // where the drag started, and are laid out again once it ends: following
    // the line would make them flicker in and out as it passes over them
    const [dragStartLine, setDragStartLine] = useState<PovertyLineText | null>(
        null
    )
    const lineForLabels = dragStartLine ?? povertyLineText
    const hasClearButton = onClearPovertyLine !== undefined
    const povertyLineLabelBox = useMemo((): LabelBox | undefined => {
        if (isStacked || !lineForLabels) return undefined
        const { box } = layoutPovertyLineLabel({
            x: xScale(lineForLabels.income),
            ballY: plotTop,
            width,
            title: lineForLabels.title,
            label: lineForLabels.label,
            hint: lineForLabels.hint,
            hasClear: hasClearButton,
            preferLeft: lineForLabels.title !== undefined,
            obstacles,
        })
        const m = POVERTY_LINE_LABEL_MARGIN
        return {
            left: box.left - m,
            right: box.right + m,
            top: box.top - m,
            bottom: box.bottom + m,
        }
    }, [
        isStacked,
        lineForLabels,
        xScale,
        plotTop,
        width,
        hasClearButton,
        obstacles,
    ])

    const countryLabelFontSize = isNarrow
        ? COUNTRY_LABEL_FONT_SIZE_NARROW
        : COUNTRY_LABEL_FONT_SIZE
    const countryLabels = useMemo((): CurveLabelLayout | undefined => {
        if (isStacked || !showSeriesLabels) return undefined
        const candidates = model.series.map((s): CurveLabelCandidate => ({
            key: s.key,
            width: Bounds.forText(s.key, {
                fontSize: countryLabelFontSize,
                fontWeight: COUNTRY_LABEL_FONT_WEIGHT,
            }).width,
            points: incomes.map((income, i) => ({
                x: xScale(income),
                y: yScale(s.y1[i]),
            })),
        }))
        const options = {
            bounds: {
                left: plotLeft,
                right: plotRight,
                top: plotTop + COUNTRY_LABEL_TOP_INSET,
                bottom: plotBottom,
            },
            labelHeight: countryLabelFontSize * COUNTRY_LABEL_LINE_HEIGHT,
            maxLabels: isNarrow
                ? MAX_COUNTRY_LABELS_NARROW
                : MAX_COUNTRY_LABELS,
            obstacles: [
                ...(obstacles ?? []),
                ...(legendBox ? [legendBox] : []),
                ...(povertyLineLabelBox ? [povertyLineLabelBox] : []),
            ],
        }
        const layout = placeCurveLabels(candidates, options)
        if (leftoverLegendTop === undefined) return layout
        // The box lists every country once any label had to be left out, so
        // place the labels as if it weren't there, then hide the ones it
        // ends up covering
        const allKeys = model.series.map((series) => series.key)
        return hideLabelsUnderBox(layout, (dropped) =>
            dropped.length === 0
                ? undefined
                : estimateLeftoverLegendBox(allKeys, {
                      top: leftoverLegendTop,
                      right: width - MARGIN.right,
                  })
        )
    }, [
        isStacked,
        model.series,
        incomes,
        xScale,
        yScale,
        countryLabelFontSize,
        isNarrow,
        plotLeft,
        plotRight,
        plotTop,
        plotBottom,
        obstacles,
        legendBox,
        povertyLineLabelBox,
        leftoverLegendTop,
        width,
        showSeriesLabels,
    ])

    // Reported by value, so a new layout with the same leftovers doesn't
    // re-render the caller
    const unlabelledCountries = countryLabels?.dropped.join("\n")
    useEffect(() => {
        if (unlabelledCountries !== undefined)
            onUnlabelledCountriesChange?.(
                unlabelledCountries === ""
                    ? []
                    : unlabelledCountries.split("\n")
            )
    }, [unlabelledCountries, onUnlabelledCountriesChange])

    const seriesColors = useMemo(
        () => new Map(model.series.map((s) => [s.key, s.color])),
        [model.series]
    )

    // Series the hovered entity covers: itself, or the countries of a hovered
    // region
    const highlightedKeys = useMemo(() => {
        if (hoveredEntity === null) return undefined
        const keys = new Set(
            model.series
                .filter(
                    (series) =>
                        series.key === hoveredEntity ||
                        series.region === hoveredEntity
                )
                .map((series) => series.key)
        )
        return keys.size > 0 ? keys : undefined
    }, [model.series, hoveredEntity])

    const [pointer, setPointer] = useState<PointerState | null>(null)
    const svgRef = useRef<SVGSVGElement>(null)
    const pointerDownRef = useRef<Position | null>(null)

    // Touch only: a tap outside the chart or scrolling it away also ends
    // the entity highlight a tap on an area started
    const dismissPointer = useCallback(() => {
        setPointer(null)
        onHoverEntity(null)
    }, [onHoverEntity])
    const { ref: chartRef, isPinned } = usePinnedTooltip<HTMLDivElement>(
        pointer !== null,
        dismissPointer
    )

    const pointerStateFromEvent = useCallback(
        (event: { clientX: number; clientY: number }): PointerState | null => {
            if (!svgRef.current) return null
            const position = getRelativeMouse(svgRef.current, event)
            return {
                income: xScale.invert(position.x),
                position: { x: position.x, y: position.y },
            }
        },
        [xScale]
    )

    // Set while the poverty line is being dragged; the drag handlers live on
    // the line itself, which captures the pointer
    const isDraggingRef = useRef(false)

    // Where the hint of the × next to the poverty line's label goes, while
    // the × is hovered or focused
    const [clearHintAt, setClearHintAt] = useState<Position | null>(null)

    const handlePointerMove = useCallback(
        (event: React.PointerEvent<SVGSVGElement>) => {
            if (event.pointerType !== "mouse" || isDraggingRef.current) return
            setPointer(pointerStateFromEvent(event))
        },
        [pointerStateFromEvent]
    )
    const handlePointerLeave = useCallback(
        (event: React.PointerEvent<SVGSVGElement>) => {
            // On touch devices, dismissal is handled by usePinnedTooltip
            if (event.pointerType === "mouse") setPointer(null)
        },
        []
    )
    const handlePointerDown = useCallback(
        (event: React.PointerEvent<SVGSVGElement>) => {
            pointerDownRef.current = { x: event.clientX, y: event.clientY }
            if (event.pointerType !== "mouse")
                setPointer(pointerStateFromEvent(event))
        },
        [pointerStateFromEvent]
    )
    const handleClick = useCallback(
        (event: React.MouseEvent<SVGSVGElement>) => {
            const start = pointerDownRef.current
            pointerDownRef.current = null
            if (
                start &&
                Math.hypot(event.clientX - start.x, event.clientY - start.y) >
                    DRAG_THRESHOLD
            )
                return
            const state = pointerStateFromEvent(event)
            if (state) onSetPovertyLine(state.income)
        },
        [pointerStateFromEvent, onSetPovertyLine]
    )

    const [minIncome, maxIncome] = xScale.domain()
    const clampIncome = useCallback(
        (income: number) => R.clamp(income, { min: minIncome, max: maxIncome }),
        [minIncome, maxIncome]
    )
    const handleLinePointerDown = useCallback(
        (event: React.PointerEvent<SVGGElement>) => {
            // Grabbing the line moves it; it mustn't also count as a click on the plot
            event.stopPropagation()
            event.currentTarget.setPointerCapture(event.pointerId)
            isDraggingRef.current = true
            setDragStartLine(povertyLineText)
            setPointer(null)
        },
        [povertyLineText]
    )
    const handleLinePointerMove = useCallback(
        (event: React.PointerEvent<SVGGElement>) => {
            if (!isDraggingRef.current) return
            event.stopPropagation()
            const state = pointerStateFromEvent(event)
            if (state) onSetPovertyLine(clampIncome(state.income))
        },
        [pointerStateFromEvent, onSetPovertyLine, clampIncome]
    )
    const handleLinePointerUp = useCallback(
        (event: React.PointerEvent<SVGGElement>) => {
            if (!isDraggingRef.current) return
            isDraggingRef.current = false
            setDragStartLine(null)
            event.currentTarget.releasePointerCapture(event.pointerId)
        },
        []
    )
    const handleLineKeyDown = useCallback(
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

    // Entity hover, delegated from the area paths via their data-key
    const handleAreaPointerOver = useCallback(
        (event: React.PointerEvent<SVGGElement>) => {
            if (event.pointerType !== "mouse") return
            const key = seriesKeyOf(event.target)
            if (key !== null) onHoverEntity(key)
        },
        [onHoverEntity]
    )
    const handleAreaPointerLeave = useCallback(
        (event: React.PointerEvent<SVGGElement>) => {
            if (event.pointerType === "mouse") onHoverEntity(null)
        },
        [onHoverEntity]
    )
    const handleAreaPointerDown = useCallback(
        (event: React.PointerEvent<SVGGElement>) => {
            if (event.pointerType === "mouse") return
            const key = seriesKeyOf(event.target)
            if (key !== null) onHoverEntity(key === hoveredEntity ? null : key)
        },
        [onHoverEntity, hoveredEntity]
    )

    const clipPathId = `income-distribution-highlight-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`

    const hoveredIncome = pointer?.income ?? null
    const threshold = povertyLine ?? hoveredIncome
    const thresholdX = threshold !== null ? xScale(threshold) : null

    const containerBounds = useMemo(
        () => new Bounds(0, 0, width, height),
        [width, height]
    )

    const tooltipEntity = hoveredEntity ?? WORLD_ENTITY_NAME
    const tooltipColor =
        tooltipEntity === WORLD_ENTITY_NAME
            ? WORLD_COLOR
            : (model.legend.find((entry) => entry.key === tooltipEntity)
                  ?.color ??
              model.series.find((series) => series.key === tooltipEntity)
                  ?.color)

    const noun = timeIntervalNoun(timeInterval)
    const ariaLabel = isStacked
        ? `Distribution of the world population by income per ${noun} in ${year}, stacked by world region, on a logarithmic income axis.`
        : `Distribution of income per ${noun} in ${year} in ${model.legend.map((entry) => entry.key).join(", ")}, on a logarithmic income axis.`

    return (
        <div ref={chartRef} className="income-distribution-chart">
            <svg
                ref={svgRef}
                className="income-distribution-chart__svg"
                width={width}
                height={height}
                // Not "img", which would hide the poverty line's slider and
                // its remove button from assistive tech
                role="group"
                aria-label={ariaLabel}
                onPointerMove={isInteractive ? handlePointerMove : undefined}
                onPointerLeave={isInteractive ? handlePointerLeave : undefined}
                onPointerDown={isInteractive ? handlePointerDown : undefined}
                onClick={isInteractive ? handleClick : undefined}
                style={isInteractive ? undefined : { cursor: "default" }}
            >
                <defs>
                    <clipPath id={clipPathId}>
                        <rect
                            x={0}
                            y={0}
                            width={Math.max(thresholdX ?? width, 0)}
                            height={height}
                        />
                    </clipPath>
                </defs>

                <XAxis
                    ticks={ticks}
                    xScale={xScale}
                    plotTop={plotTop}
                    plotBottom={plotBottom}
                    plotLeft={plotLeft}
                    plotRight={plotRight}
                    fontSize={tickFontSize}
                    isNarrow={isNarrow}
                    per={noun}
                    currencyLabel={
                        currency.code === INTERNATIONAL_DOLLAR.code
                            ? "international-$"
                            : formatCurrencyLabel(currency)
                    }
                />

                <g
                    className="income-distribution-chart__areas"
                    opacity={
                        ghostSeries
                            ? GHOST_OPACITY
                            : thresholdX !== null
                              ? FADED_OPACITY
                              : 1
                    }
                    onPointerOver={
                        isInteractive ? handleAreaPointerOver : undefined
                    }
                    onPointerLeave={
                        isInteractive ? handleAreaPointerLeave : undefined
                    }
                    onPointerDown={
                        isInteractive ? handleAreaPointerDown : undefined
                    }
                >
                    <AreaLayer
                        series={model.series}
                        paths={paths}
                        isStacked={isStacked}
                        highlightedKeys={highlightedKeys}
                        xScale={xScale}
                        plotTop={plotTop}
                        plotBottom={plotBottom}
                        maskIdBase={`${clipPathId}-fade`}
                    />
                </g>
                {fillBelowLine && totalPaths && povertyLine !== null && (
                    <path
                        className="income-distribution-chart__fill-below-line"
                        d={totalPaths.area}
                        fill={EMPHASIS_COLOR}
                        clipPath={`url(#${clipPathId})`}
                        pointerEvents="none"
                    />
                )}
                {thresholdX !== null && !ghostSeries && (
                    <g
                        className="income-distribution-chart__areas income-distribution-chart__areas--highlight"
                        clipPath={`url(#${clipPathId})`}
                    >
                        <AreaLayer
                            series={model.series}
                            paths={paths}
                            isStacked={isStacked}
                            highlightedKeys={highlightedKeys}
                            xScale={xScale}
                            plotTop={plotTop}
                            plotBottom={plotBottom}
                            maskIdBase={`${clipPathId}-fade-highlight`}
                        />
                    </g>
                )}

                {outlineTotal && totalPaths && totalPeak && (
                    <g
                        className="income-distribution-chart__outline"
                        pointerEvents="none"
                    >
                        <DrawnPath
                            d={totalPaths.outline}
                            fill="none"
                            stroke={EMPHASIS_COLOR}
                            strokeWidth={2}
                            strokeLinejoin="round"
                        />
                        {/* Once the outline has drawn itself */}
                        <g className="income-distribution-chart__outline-extras">
                            {outlineTotal.label && (
                                <text
                                    className="income-distribution-chart__outline-label"
                                    x={totalPeak.x + OUTLINE_LABEL_OFFSET}
                                    y={totalPeak.y}
                                    dy="0.71em"
                                    fontSize={isNarrow ? 13 : 14}
                                    fill={EMPHASIS_COLOR}
                                >
                                    {outlineTotal.label}
                                </text>
                            )}
                        </g>
                    </g>
                )}

                {axisEndLabels && (
                    <AxisEndLabels
                        {...axisEndLabels}
                        plotLeft={plotLeft}
                        plotRight={plotRight}
                        y={plotBottom - 8}
                        fontSize={isNarrow ? 12 : 14}
                    />
                )}

                {placedAnnotations.map(
                    ({ key, arrow }) =>
                        arrow && (
                            <BezierArrow
                                key={key}
                                className="income-distribution-chart__annotation-arrow"
                                {...arrow}
                                color={GRAY_70}
                                width={1}
                            />
                        )
                )}

                {regionLabels.map((label) => (
                    <text
                        key={label.region}
                        className="income-distribution-chart__region-label"
                        x={label.x}
                        y={label.y}
                        fontSize={label.fontSize}
                        textAnchor="middle"
                        dominantBaseline="central"
                    >
                        {displayRegionName(label.region)}
                    </text>
                ))}

                {countryLabels && (
                    <g
                        className="income-distribution-chart__country-labels"
                        onPointerOver={handleAreaPointerOver}
                        onPointerLeave={handleAreaPointerLeave}
                        onPointerDown={handleAreaPointerDown}
                    >
                        <CountryLabelLayer
                            labels={countryLabels.labels}
                            colors={seriesColors}
                            fontSize={countryLabelFontSize}
                            highlightedKeys={highlightedKeys}
                        />
                    </g>
                )}

                {povertyLine !== null && povertyLineText && (
                    <PovertyLine
                        x={xScale(povertyLine)}
                        plotTop={plotTop}
                        plotBottom={plotBottom}
                        width={width}
                        obstacles={obstacles}
                        title={povertyLineText.title}
                        label={povertyLineText.label}
                        hint={povertyLineText.hint}
                        isFixed={isPovertyLineFixed}
                        valueNow={povertyLine}
                        valueMin={minIncome}
                        valueMax={maxIncome}
                        onPointerDown={handleLinePointerDown}
                        onPointerMove={handleLinePointerMove}
                        onPointerUp={handleLinePointerUp}
                        onKeyDown={handleLineKeyDown}
                        onClear={clearPovertyLine}
                        onClearHintChange={setClearHintAt}
                    />
                )}

                {hoveredIncome !== null && (
                    <PointerLine
                        x={xScale(hoveredIncome)}
                        plotTop={plotTop}
                        plotBottom={plotBottom}
                        width={width}
                        fontSize={tickFontSize}
                        label={formatIncome(
                            hoveredIncome,
                            currency,
                            timeInterval
                        )}
                    />
                )}
            </svg>

            {/* With a line set, its figure is fixed by the line and the
                legend already shows it, so only the hover line previews
                where a click would move the line */}
            {pointer && povertyLine === null && (
                <IncomeDistributionTooltip
                    position={pointer.position}
                    containerBounds={containerBounds}
                    isPinned={isPinned}
                    line={pointer.income}
                    hoveredEntity={hoveredEntity}
                    yearData={yearData}
                    year={year}
                    currency={currency}
                    timeInterval={timeInterval}
                    color={tooltipColor}
                    hintOnly={!isStacked && hoveredEntity === null}
                />
            )}

            {placedAnnotations.map(({ key, content, isHint, style }) => (
                <div
                    key={key}
                    className={
                        isHint
                            ? "income-distribution-chart__annotation income-distribution-chart__annotation--hint"
                            : "income-distribution-chart__annotation"
                    }
                    style={style}
                >
                    {content}
                </div>
            ))}

            {clearHintAt && (
                <div
                    className="income-distribution-hint"
                    style={{ left: clearHintAt.x, top: clearHintAt.y }}
                    aria-hidden
                >
                    Remove poverty line
                </div>
            )}
        </div>
    )
}

/**
 * Memoised: its props only change with the model, the size or the hovered
 * entity, so pointer moves don't redraw the paths.
 */
const AreaLayer = memo(function AreaLayer({
    series,
    paths,
    isStacked,
    highlightedKeys,
    xScale,
    plotTop,
    plotBottom,
    maskIdBase,
}: {
    series: ChartSeries[]
    paths: string[]
    isStacked: boolean
    highlightedKeys: Set<string> | undefined
    xScale: ScaleLogarithmic<number, number>
    plotTop: number
    plotBottom: number
    /** Unique in the document; the tail fades' masks are named from it */
    maskIdBase: string
}): React.ReactElement {
    // A long tail fades out towards the edge: the curve is drawn through a
    // mask that goes from opaque at the fade's inner end to clear at its outer
    // end (see tails.ts)
    const fadeMasks = series.flatMap((s, i) => {
        const { left, right } = s.fades ?? {}
        if (!left && !right) return []
        const id = `${maskIdBase}-${i}`
        const [x0, x1] = xScale.range()
        const stops: { x: number; opacity: number }[] = [
            { x: x0, opacity: left ? 0 : 1 },
            ...(left
                ? [
                      { x: xScale(left.from), opacity: 0 },
                      { x: xScale(left.to), opacity: 1 },
                  ]
                : []),
            ...(right
                ? [
                      { x: xScale(right.to), opacity: 1 },
                      { x: xScale(right.from), opacity: 0 },
                  ]
                : []),
            { x: x1, opacity: right ? 0 : 1 },
        ]
        return [{ id, stops }]
    })
    const maskIdOf = (index: number): string | undefined =>
        fadeMasks.find((m) => m.id === `${maskIdBase}-${index}`)?.id
    return (
        <>
            {fadeMasks.length > 0 && (
                <defs>
                    {fadeMasks.map(({ id, stops }) => {
                        const [x0, x1] = xScale.range()
                        return (
                            <Fragment key={id}>
                                <linearGradient
                                    id={`${id}-gradient`}
                                    gradientUnits="userSpaceOnUse"
                                    x1={x0}
                                    x2={x1}
                                    y1={0}
                                    y2={0}
                                >
                                    {stops.map((stop, j) => (
                                        <stop
                                            key={j}
                                            offset={(stop.x - x0) / (x1 - x0)}
                                            stopColor="white"
                                            stopOpacity={stop.opacity}
                                        />
                                    ))}
                                </linearGradient>
                                <mask id={id} maskUnits="userSpaceOnUse">
                                    <rect
                                        x={x0 - 4}
                                        y={plotTop - 4}
                                        width={x1 - x0 + 8}
                                        height={plotBottom - plotTop + 8}
                                        fill={`url(#${id}-gradient)`}
                                    />
                                </mask>
                            </Fragment>
                        )
                    })}
                </defs>
            )}
            {series.map((s, i) => {
                const isHighlighted = highlightedKeys?.has(s.key) ?? false
                const isDimmed = highlightedKeys !== undefined && !isHighlighted
                const maskId = maskIdOf(i)
                return (
                    <path
                        key={s.key}
                        data-key={s.key}
                        mask={maskId ? `url(#${maskId})` : undefined}
                        d={paths[i]}
                        fill={s.color}
                        fillOpacity={isStacked ? 1 : 0.5}
                        stroke={isStacked ? GRAPHER_BACKGROUND : s.color}
                        strokeWidth={
                            isStacked
                                ? isHighlighted
                                    ? 1
                                    : 0.5
                                : isHighlighted
                                  ? 2.5
                                  : 1.5
                        }
                        strokeLinejoin="round"
                        opacity={isDimmed ? DIMMED_OPACITY : 1}
                    />
                )
            })}
        </>
    )
})

/**
 * The country names above their curves, in the curves' colours. Memoised
 * like AreaLayer, so pointer moves don't redraw them.
 */
const CountryLabelLayer = memo(function CountryLabelLayer({
    labels,
    colors,
    fontSize,
    highlightedKeys,
}: {
    labels: CurveLabelLayout["labels"]
    colors: Map<string, string>
    fontSize: number
    highlightedKeys: Set<string> | undefined
}): React.ReactElement {
    return (
        <>
            {labels.map((label) => {
                const color = colors.get(label.key) ?? GRAPHER_DARK_TEXT
                const isDimmed =
                    highlightedKeys !== undefined &&
                    !highlightedKeys.has(label.key)
                return (
                    <text
                        key={label.key}
                        data-key={label.key}
                        className="income-distribution-chart__country-label"
                        x={label.x}
                        y={label.y}
                        // The box's bottom is the text's descent line
                        dy="-0.25em"
                        textAnchor="middle"
                        fontSize={fontSize}
                        fontWeight={COUNTRY_LABEL_FONT_WEIGHT}
                        fill={darkenColorForText(color)}
                        opacity={isDimmed ? DIMMED_OPACITY : 1}
                    >
                        {label.key}
                    </text>
                )
            })}
        </>
    )
})

function XAxis({
    ticks,
    xScale,
    plotTop,
    plotBottom,
    plotLeft,
    plotRight,
    fontSize,
    isNarrow,
    per,
    currencyLabel,
}: {
    ticks: AxisTick[]
    xScale: ScaleLogarithmic<number, number>
    plotTop: number
    plotBottom: number
    plotLeft: number
    plotRight: number
    fontSize: number
    /** Narrow charts split the axis label onto two lines */
    isNarrow: boolean
    /** "day", "month" or "year" */
    per: string
    /** "international-$" or "Euro (Germany)" */
    currencyLabel: string
}): React.ReactElement {
    return (
        <g className="income-distribution-chart__axis" pointerEvents="none">
            {/* Under the tick labels, centred on the plot */}
            <text
                className="income-distribution-chart__axis-label"
                x={(plotLeft + plotRight) / 2}
                y={plotBottom + 36}
                dy="0.71em"
                textAnchor="middle"
                fontSize={fontSize}
                fill={GRAPHER_LIGHT_TEXT}
            >
                {isNarrow ? (
                    <>
                        <tspan x={(plotLeft + plotRight) / 2}>
                            Income or consumption per {per} in {currencyLabel}
                        </tspan>
                        <tspan x={(plotLeft + plotRight) / 2} dy="1.25em">
                            logarithmic scale
                        </tspan>
                    </>
                ) : (
                    `Income or consumption per ${per} in ${currencyLabel} — logarithmic scale`
                )}
            </text>
            {ticks.map((tick) => {
                const x = xScale(tick.value)
                const isLabelled = tick.label !== undefined
                return (
                    <g key={tick.value}>
                        {isLabelled && (
                            <line
                                x1={x}
                                x2={x}
                                y1={plotTop}
                                y2={plotBottom}
                                stroke={GRAY_20}
                            />
                        )}
                        <line
                            x1={x}
                            x2={x}
                            y1={plotBottom}
                            y2={plotBottom + (isLabelled ? 5 : 3)}
                            stroke={GRAPHER_LIGHT_TEXT}
                        />
                        {isLabelled && (
                            <text
                                x={x}
                                y={plotBottom + 9}
                                dy="0.71em"
                                textAnchor="middle"
                                fontSize={fontSize}
                                fill={GRAPHER_LIGHT_TEXT}
                            >
                                {tick.label}
                            </text>
                        )}
                    </g>
                )
            })}
        </g>
    )
}

/**
 * "$3 a day", plus the same amount in the chart's units when those differ,
 * e.g. "$3 a day or €79 per month"
 */
function internationalPovertyLineAmount(
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

/**
 * The poverty line, drawn like a pin: a dashed line topped by a ball, with
 * its label beside the ball and a × that removes the line. The line and the
 * ball are the grab target: drag to move the line, or focus it and use the
 * arrow keys.
 */
function PovertyLine({
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
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
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
    onPointerDown: (event: React.PointerEvent<SVGGElement>) => void
    onPointerMove: (event: React.PointerEvent<SVGGElement>) => void
    onPointerUp: (event: React.PointerEvent<SVGGElement>) => void
    onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => void
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
                          onPointerDown,
                          onPointerMove,
                          onPointerUp,
                          onPointerCancel: onPointerUp,
                          onKeyDown,
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

function PointerLine({
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

/**
 * Mirrors the overlay legend's swatch rows (IncomeDistributionLegend.scss):
 * 10px 12px padding, a 1px border, rows of 12px text at 1.25 line height with
 * 2px padding above and below, a 10px swatch and a 6px gap before the label,
 * which is capped at 260px
 */
const LEFTOVER_LEGEND = {
    paddingX: 12 + 1,
    paddingY: 10 + 1,
    rowHeight: 12 * 1.25 + 4,
    markWidth: 10 + 6,
    fontSize: 12,
    maxLabelWidth: 260,
    /** For rounding and font differences */
    slack: 4,
}

/**
 * Where the overlay legend listing `keys` will be, right-aligned at `right`
 * from `top` down; undefined when there's nothing to list
 */
function estimateLeftoverLegendBox(
    keys: string[],
    { top, right }: { top: number; right: number }
): LabelBox | undefined {
    if (keys.length === 0) return undefined
    const labelWidth = Math.min(
        Math.max(
            ...keys.map(
                (key) =>
                    Bounds.forText(key, { fontSize: LEFTOVER_LEGEND.fontSize })
                        .width
            )
        ),
        LEFTOVER_LEGEND.maxLabelWidth
    )
    const width =
        2 * LEFTOVER_LEGEND.paddingX +
        LEFTOVER_LEGEND.markWidth +
        labelWidth +
        LEFTOVER_LEGEND.slack
    const height =
        2 * LEFTOVER_LEGEND.paddingY +
        keys.length * LEFTOVER_LEGEND.rowHeight +
        LEFTOVER_LEGEND.slack
    return { left: right - width, right, top, bottom: top + height }
}

/** Below this share of a series' tallest point, it has no data worth drawing */
const EMPTY_HEIGHT_RATIO = 1e-3

/**
 * One area path per series. Where a series has (next to) no height, as a
 * country's curve does outside its data's range, the path stops rather than
 * running on along the axis as a flat line.
 */
function computeAreaPaths(
    series: ChartSeries[],
    incomes: number[],
    xScale: ScaleLogarithmic<number, number>,
    yScale: ScaleLinear<number, number>
): string[] {
    return series.map((s) => {
        const heights = s.y1.map((y, i) => y - s.y0[i])
        const threshold = Math.max(...heights) * EMPTY_HEIGHT_RATIO
        const generator = area<number>()
            .defined((_, i) => heights[i] > threshold)
            .x((_, i) => xScale(incomes[i]))
            .y0((_, i) => yScale(s.y0[i]))
            .y1((_, i) => yScale(s.y1[i]))
            .curve(curveMonotoneX)
        return generator(s.y1) ?? ""
    })
}

/**
 * Ticks at round amounts in the displayed currency and interval (1, 2, 3, 5
 * × 10^k by default), positioned in int-$/day. The other multiples get
 * unlabelled minor ticks, as does a labelled multiple whose label would
 * overlap a higher-priority neighbour's (`labelledMultipliers` is in order
 * of priority). A currency written as its code (CHF) is named on the first
 * label only; the rest are bare numbers.
 */
function computeAxisTicks(
    xScale: ScaleLogarithmic<number, number>,
    currency: Currency,
    timeInterval: TimeInterval,
    labelledMultipliers: number[],
    fontSize: number
): AxisTick[] {
    const factor = combinedFactor(currency, timeInterval)
    if (!(factor > 0)) return []
    const [min, max] = xScale.domain()
    const codeOnFirstLabelOnly = isCurrencyWrittenAsCode(currency)
    const ticks: (AxisTick & { multiplier: number })[] = []
    for (
        let power = Math.floor(Math.log10(min * factor));
        Math.pow(10, power) <= max * factor;
        power++
    ) {
        for (const multiplier of TICK_MULTIPLIERS) {
            // Round away float noise like 3 × 0.1 = 0.30000000000000004
            const displayed = Number(
                (multiplier * Math.pow(10, power)).toPrecision(12)
            )
            const value = displayed / factor
            if (value < min || value > max) continue
            ticks.push({
                value,
                multiplier,
                label: labelledMultipliers.includes(multiplier)
                    ? formatIncome(value, currency, timeInterval, {
                          short: true,
                          dropCode: codeOnFirstLabelOnly,
                      })
                    : undefined,
            })
        }
    }
    const firstLabelled = ticks.find((tick) => tick.label !== undefined)
    if (codeOnFirstLabelOnly && firstLabelled)
        firstLabelled.label = formatIncome(
            firstLabelled.value,
            currency,
            timeInterval,
            { short: true }
        )

    // Place the labels by priority, dropping any that would overlap one
    // already placed
    const placed: { left: number; right: number }[] = []
    const keep = new Set<AxisTick>()
    // The label naming the currency goes first, so it's always there
    const namesCurrency = codeOnFirstLabelOnly ? firstLabelled : undefined
    const byPriority = [
        ...(namesCurrency ? [namesCurrency] : []),
        ...labelledMultipliers.flatMap((multiplier) =>
            ticks.filter(
                (tick) =>
                    tick.multiplier === multiplier &&
                    tick.label !== undefined &&
                    tick !== namesCurrency
            )
        ),
    ]
    for (const tick of byPriority) {
        if (tick.label === undefined) continue
        const halfWidth =
            Bounds.forText(tick.label, { fontSize }).width / 2 +
            TICK_LABEL_GAP / 2
        const x = xScale(tick.value)
        const box = { left: x - halfWidth, right: x + halfWidth }
        const overlaps = placed.some(
            (other) => box.left < other.right && box.right > other.left
        )
        if (overlaps) continue
        placed.push(box)
        keep.add(tick)
    }
    return ticks.map((tick) => {
        const { multiplier: _multiplier, ...rest } = tick
        return keep.has(tick) ? rest : { ...rest, label: undefined }
    })
}

/**
 * A stroked path that draws itself in from its start when it first appears
 * (the emphasised outline of the total), unless the reader prefers reduced
 * motion. Later changes to `d`, e.g. on resize, show at once.
 */
function DrawnPath(props: React.SVGProps<SVGPathElement>): React.ReactElement {
    const ref = useRef<SVGPathElement>(null)
    useEffect(() => {
        const element = ref.current
        if (
            !element ||
            typeof element.animate !== "function" ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        )
            return
        const length = element.getTotalLength()
        element.style.strokeDasharray = `${length}`
        const animation = element.animate(
            [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
            { duration: OUTLINE_DRAW_MS, easing: "ease-in-out" }
        )
        const settle = (): void => {
            element.style.strokeDasharray = ""
        }
        animation.addEventListener("finish", settle)
        return () => {
            animation.cancel()
            settle()
        }
    }, [])
    return <path ref={ref} {...props} />
}

/** The series a delegated pointer event landed on, from the path's data attribute */
function seriesKeyOf(target: EventTarget): string | null {
    if (!(target instanceof Element)) return null
    return target.getAttribute("data-key")
}

/** "⟵ Poorest" and "Richest ⟶" just above either end of the x axis */
function AxisEndLabels({
    left,
    right,
    plotLeft,
    plotRight,
    y,
    fontSize,
}: {
    left: string
    right: string
    plotLeft: number
    plotRight: number
    /** Baseline */
    y: number
    fontSize: number
}): React.ReactElement {
    const arrowLength = 18
    const gap = 4
    const arrowY = y - fontSize * 0.3
    const textProps = {
        y,
        fontSize,
        fill: GRAPHER_LIGHT_TEXT,
        stroke: GRAPHER_BACKGROUND,
        strokeWidth: 3,
        paintOrder: "stroke",
    } as const
    return (
        <g
            className="income-distribution-chart__axis-ends"
            pointerEvents="none"
        >
            <BezierArrow
                start={{ x: plotLeft + arrowLength, y: arrowY }}
                end={{ x: plotLeft, y: arrowY }}
                color={GRAPHER_LIGHT_TEXT}
                headLength={4}
            />
            <text x={plotLeft + arrowLength + gap} {...textProps}>
                {left}
            </text>
            <BezierArrow
                start={{ x: plotRight - arrowLength, y: arrowY }}
                end={{ x: plotRight, y: arrowY }}
                color={GRAPHER_LIGHT_TEXT}
                headLength={4}
            />
            <text
                x={plotRight - arrowLength - gap}
                textAnchor="end"
                {...textProps}
            >
                {right}
            </text>
        </g>
    )
}

/** The value of `values` (one per grid point) at `income`, interpolated on the log axis */
function valueAtIncome(
    values: number[],
    incomes: number[],
    income: number
): number {
    const i = R.sortedIndex(incomes, income)
    if (i <= 0) return values[0]
    if (i >= incomes.length) return values[values.length - 1]
    const t =
        (Math.log(income) - Math.log(incomes[i - 1])) /
        (Math.log(incomes[i]) - Math.log(incomes[i - 1]))
    return values[i - 1] + t * (values[i] - values[i - 1])
}

function annotationTargetPoint(
    target: ChartAnnotationTarget,
    {
        povertyLine,
        model,
        xScale,
        yScale,
        plotTop,
        plotBottom,
    }: {
        povertyLine: number | null
        model: IncomeDistributionChartModel
        xScale: ScaleLogarithmic<number, number>
        yScale: ScaleLinear<number, number>
        plotTop: number
        plotBottom: number
    }
): { x: number; y: number } {
    const income =
        target.income === "povertyLine"
            ? (povertyLine ?? xScale.domain()[0])
            : target.income
    const x = xScale(income)
    if ("plot" in target.y)
        return { x, y: plotTop + target.y.plot * (plotBottom - plotTop) }
    const { curve, fraction = 1 } = target.y
    const series =
        curve === "total"
            ? model.series[model.series.length - 1]
            : model.series.find((s) => s.key === curve)
    if (!series) return { x, y: plotBottom }
    const top = valueAtIncome(series.y1, model.grid.incomes, income)
    const bottom = valueAtIncome(series.y0, model.grid.incomes, income)
    return { x, y: yScale(bottom + fraction * (top - bottom)) }
}

interface PlacedAnnotation {
    key: string
    content: React.ReactNode
    isHint: boolean
    /** Of the text block, absolutely positioned in the chart's container */
    style: React.CSSProperties
    arrow?: Pick<
        React.ComponentProps<typeof BezierArrow>,
        "start" | "end" | "startHandle" | "endHandle"
    >
}

/** Pixel positions of an annotation's text and arrow, the text kept inside the chart */
function placeAnnotation(
    annotation: ChartAnnotation,
    { target, width }: { target: { x: number; y: number }; width: number }
): PlacedAnnotation {
    const { textOffset, textAnchor = "top-left", arrow } = annotation
    const blockWidth = Math.min(annotation.width, width)
    const anchorX = target.x + textOffset.dx
    const anchorY = target.y + textOffset.dy
    const isRight = textAnchor.endsWith("right")
    const left = R.clamp(isRight ? anchorX - blockWidth : anchorX, {
        min: 0,
        max: Math.max(width - blockWidth, 0),
    })
    const style: React.CSSProperties = {
        left,
        width: blockWidth,
        textAlign: isRight ? "right" : "left",
        ...(textAnchor.startsWith("top")
            ? { top: anchorY }
            : { top: anchorY, transform: "translateY(-100%)" }),
    }

    let placedArrow: PlacedAnnotation["arrow"]
    if (arrow) {
        const start = {
            x: target.x + arrow.from.dx,
            y: target.y + arrow.from.dy,
        }
        // Stop short of the target, along the line from the start
        const gap = arrow.gap ?? 4
        const distance = Math.hypot(target.x - start.x, target.y - start.y)
        const ratio = distance > gap ? (distance - gap) / distance : 0
        const end = {
            x: start.x + (target.x - start.x) * ratio,
            y: start.y + (target.y - start.y) * ratio,
        }
        const startHandle = arrow.startHandle
            ? {
                  x: start.x + arrow.startHandle.dx,
                  y: start.y + arrow.startHandle.dy,
              }
            : undefined
        // Without an end handle of its own, the curve's end tangent runs from
        // the start handle, so the head is set along that; left out, the
        // arrow would aim its head along the straight line from its start
        const endHandle = arrow.endHandle
            ? { x: end.x + arrow.endHandle.dx, y: end.y + arrow.endHandle.dy }
            : startHandle
              ? {
                    x: end.x + (startHandle.x - end.x) * 0.3,
                    y: end.y + (startHandle.y - end.y) * 0.3,
                }
              : undefined
        placedArrow = { start, end, startHandle, endHandle }
    }

    return {
        key: annotation.key,
        content: annotation.content,
        isHint: annotation.isHint ?? false,
        style,
        arrow: placedArrow,
    }
}
