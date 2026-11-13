import {
    memo,
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react"
import * as R from "remeda"
import { scaleLinear, scaleLog } from "@visx/scale"
import { area, curveMonotoneX } from "d3-shape"
import type { ScaleLinear, ScaleLogarithmic } from "d3-scale"

import { Bounds, getRelativeMouse } from "@ourworldindata/utils"
import {
    GRAPHER_BACKGROUND,
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
    GRAY_100,
    GRAY_20,
    GRAY_60,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { darkenColorForText } from "@ourworldindata/grapher/src/color/ColorUtils.js"

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
    INT_POVERTY_LINE,
    INTERNATIONAL_DOLLAR,
    WORLD_COLOR,
    WORLD_ENTITY_NAME,
} from "../core/constants.js"
import { IncomeDistributionTooltip } from "./IncomeDistributionTooltip.js"

export interface IncomeDistributionChartProps {
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
const LABELLED_MULTIPLIERS = [1, 2, 3, 5]
const LABELLED_MULTIPLIERS_NARROW = [1, 3]

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

    const ticks = useMemo(
        () =>
            computeAxisTicks(
                xScale,
                currency,
                timeInterval,
                isNarrow ? LABELLED_MULTIPLIERS_NARROW : LABELLED_MULTIPLIERS
            ),
        [xScale, currency, timeInterval, isNarrow]
    )

    const regionLabels = useMemo(() => {
        if (model.regionBands.length === 0) return []
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
                Bounds.forText(label, { fontSize: 16, fontWeight: 700 }).width /
                16,
        })
    }, [model.regionBands, incomes, xScale, yScale, isNarrow])

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
                    },
        [povertyLine, isInternationalPovertyLine, currency, timeInterval]
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
            hasClear: hasClearButton,
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
        if (isStacked) return undefined
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
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
                onPointerDown={handlePointerDown}
                onClick={handleClick}
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
                    opacity={thresholdX !== null ? FADED_OPACITY : 1}
                    onPointerOver={handleAreaPointerOver}
                    onPointerLeave={handleAreaPointerLeave}
                    onPointerDown={handleAreaPointerDown}
                >
                    <AreaLayer
                        series={model.series}
                        paths={paths}
                        isStacked={isStacked}
                        highlightedKeys={highlightedKeys}
                    />
                </g>
                {thresholdX !== null && (
                    <g
                        className="income-distribution-chart__areas income-distribution-chart__areas--highlight"
                        clipPath={`url(#${clipPathId})`}
                    >
                        <AreaLayer
                            series={model.series}
                            paths={paths}
                            isStacked={isStacked}
                            highlightedKeys={highlightedKeys}
                        />
                    </g>
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
                        {label.region}
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
}: {
    series: ChartSeries[]
    paths: string[]
    isStacked: boolean
    highlightedKeys: Set<string> | undefined
}): React.ReactElement {
    return (
        <>
            {series.map((s, i) => {
                const isHighlighted = highlightedKeys?.has(s.key) ?? false
                const isDimmed = highlightedKeys !== undefined && !isHighlighted
                return (
                    <path
                        key={s.key}
                        data-key={s.key}
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
        hasClear: !!onClear,
        obstacles,
    })
    const clearHintPosition = { x: clearCenterX, y: ballY + clearSize / 2 + 4 }

    return (
        <g>
            <g
                className="income-distribution-chart__poverty-line"
                role="slider"
                tabIndex={0}
                aria-label="Poverty line"
                aria-valuenow={valueNow}
                aria-valuemin={valueMin}
                aria-valuemax={valueMax}
                aria-valuetext={title ? `${title}, ${label}` : label}
                aria-orientation="horizontal"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={onKeyDown}
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

function computeAreaPaths(
    series: ChartSeries[],
    incomes: number[],
    xScale: ScaleLogarithmic<number, number>,
    yScale: ScaleLinear<number, number>
): string[] {
    return series.map((s) => {
        const generator = area<number>()
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
 * unlabelled minor ticks.
 */
function computeAxisTicks(
    xScale: ScaleLogarithmic<number, number>,
    currency: Currency,
    timeInterval: TimeInterval,
    labelledMultipliers: number[]
): AxisTick[] {
    const factor = combinedFactor(currency, timeInterval)
    if (!(factor > 0)) return []
    const [min, max] = xScale.domain()
    const ticks: AxisTick[] = []
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
                label: labelledMultipliers.includes(multiplier)
                    ? formatIncome(value, currency, timeInterval, {
                          short: true,
                      })
                    : undefined,
            })
        }
    }
    return ticks
}

/** The series a delegated pointer event landed on, from the path's data attribute */
function seriesKeyOf(target: EventTarget): string | null {
    if (!(target instanceof Element)) return null
    return target.getAttribute("data-key")
}
