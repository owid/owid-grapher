import { useCallback, useId, useMemo, useRef, useState } from "react"

import { Bounds, getRelativeMouse } from "@ourworldindata/utils"
import { GRAY_70 } from "@ourworldindata/grapher/src/color/ColorConstants.js"
import { BezierArrow } from "@ourworldindata/grapher/src/arrows/BezierArrow.js"

import { ResponsiveContainer } from "../../../../components/ResponsiveContainer/ResponsiveContainer.js"
import { DrawnPath } from "../../../../components/DrawnPath/DrawnPath.js"
import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import { argMax } from "../core/argMax.js"
import type { IncomeDistributionChartModel } from "../core/chartModel.js"
import {
    formatCurrencyLabel,
    formatIncome,
    timeIntervalNoun,
} from "../core/currency.js"
import type { LabelBox } from "../core/curveLabels.js"
import type {
    Currency,
    IncomeDistributionYear,
    TimeInterval,
} from "../core/types.js"
import {
    EMPHASIS_COLOR,
    INTERNATIONAL_DOLLAR,
    WORLD_COLOR,
    WORLD_ENTITY_NAME,
} from "../core/constants.js"
import { displayEntityName } from "../core/legendLabels.js"
import { annotationTargetPoint, placeAnnotation } from "../core/annotations.js"
import {
    computeAxisTicks,
    LABELLED_MULTIPLIERS,
    LABELLED_MULTIPLIERS_NARROW,
} from "../core/axisTicks.js"
import {
    computeAreaPaths,
    computeTotalPaths,
    makeXScale,
    makeYScale,
    plotRect,
} from "../core/chartGeometry.js"
import type { ChartPresentation } from "../core/presentation.js"
import { IncomeDistributionTooltip } from "./IncomeDistributionTooltip.js"
import { AreaLayer, CountryLabelLayer, seriesKeyOf } from "./chart/AreaLayer.js"
import { AxisEndLabels, XAxis } from "./chart/XAxis.js"
import {
    internationalPovertyLineAmount,
    PointerLine,
    PovertyLine,
    usePovertyLineInteraction,
    type PovertyLineText,
    type Position,
} from "./chart/PovertyLine.js"
import {
    COUNTRY_LABEL_HEADROOM,
    useChartLabels,
} from "./chart/useChartLabels.js"

export interface IncomeDistributionChartProps extends ChartPresentation {
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

/** The areas while a threshold (the poverty line, or the hover line) splits them */
const FADED_OPACITY = 0.35
/** The areas behind an emphasised outline or fill (ghostSeries) */
const GHOST_OPACITY = 0.18

/** The outline label sits this far right of the peak, in px */
const OUTLINE_LABEL_OFFSET = 28
/** The emphasised outline draws itself in over this long when it appears */
const OUTLINE_DRAW_MS = 1500

/** A pointer that moves further than this between down and click was dragging */
const DRAG_THRESHOLD = 5

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

interface PointerState {
    /** Int-$/day under the pointer */
    income: number
    /** Relative to the chart container */
    position: Position
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
    const plot = plotRect(width, height, isNarrow)
    const {
        left: plotLeft,
        right: plotRight,
        top: plotTop,
        bottom: plotBottom,
    } = plot
    const tickFontSize = isNarrow ? 11 : 12

    const incomes = model.grid.incomes
    const isStacked = model.regionBands.length > 0

    const xScale = useMemo(
        () => makeXScale(incomes, [plotLeft, plotRight]),
        [incomes, plotLeft, plotRight]
    )
    // Unstacked curves get room above them for their labels
    const yTop = isStacked
        ? plotTop
        : Math.min(plotTop + COUNTRY_LABEL_HEADROOM, plotBottom)
    const yScale = useMemo(
        () => makeYScale(model.yMax, [plotBottom, yTop]),
        [model.yMax, plotBottom, yTop]
    )

    const paths = useMemo(
        () => computeAreaPaths(model.series, incomes, xScale, yScale),
        [model.series, incomes, xScale, yScale]
    )

    // The top of the stack, for its outline and the fill below the line
    const totalTop = isStacked
        ? model.series[model.series.length - 1]?.y1
        : undefined
    const totalPaths = useMemo(
        () =>
            totalTop && (outlineTotal || fillBelowLine)
                ? computeTotalPaths(totalTop, incomes, xScale, yScale)
                : undefined,
        [totalTop, outlineTotal, fillBelowLine, incomes, xScale, yScale]
    )
    const totalPeak = useMemo(() => {
        const i = totalTop ? argMax(totalTop) : undefined
        if (!totalTop || i === undefined) return undefined
        return { x: xScale(incomes[i]), y: yScale(totalTop[i]) }
    }, [totalTop, incomes, xScale, yScale])

    const placedAnnotations = useMemo(
        () =>
            (annotations ?? []).map((annotation) =>
                placeAnnotation(annotation, {
                    target: annotationTargetPoint(annotation.target, {
                        model,
                        xScale,
                        yScale,
                        plotTop,
                        plotBottom,
                    }),
                    width,
                })
            ),
        [annotations, model, xScale, yScale, plotTop, plotBottom, width]
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
    const incomeAtEvent = useCallback(
        (event: { clientX: number; clientY: number }): number | null =>
            pointerStateFromEvent(event)?.income ?? null,
        [pointerStateFromEvent]
    )
    const hidePointer = useCallback(() => setPointer(null), [])

    const {
        lineHandlers,
        isDraggingRef,
        dragStartLine,
        clearHintAt,
        setClearHintAt,
        clearPovertyLine,
    } = usePovertyLineInteraction({
        povertyLine,
        povertyLineText,
        xScale,
        incomeAtEvent,
        onSetPovertyLine,
        onClearPovertyLine,
        onDragStart: hidePointer,
    })

    const { regionLabels, countryLabels, countryLabelFontSize } =
        useChartLabels({
            model,
            xScale,
            yScale,
            plot,
            width,
            isNarrow,
            showSeriesLabels,
            ghostSeries,
            lineForLabels: dragStartLine ?? povertyLineText,
            hasClearButton: onClearPovertyLine !== undefined,
            obstacles,
            legendBox,
            leftoverLegendTop,
            onUnlabelledCountriesChange,
        })

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

    const handlePointerMove = useCallback(
        (event: React.PointerEvent<SVGSVGElement>) => {
            if (event.pointerType !== "mouse" || isDraggingRef.current) return
            setPointer(pointerStateFromEvent(event))
        },
        [pointerStateFromEvent, isDraggingRef]
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
    const [minIncome, maxIncome] = xScale.domain()

    const containerBounds = useMemo(
        () => new Bounds(0, 0, width, height),
        [width, height]
    )

    const tooltipEntity = hoveredEntity ?? WORLD_ENTITY_NAME
    const tooltipColor =
        tooltipEntity === WORLD_ENTITY_NAME
            ? WORLD_COLOR
            : seriesColors.get(tooltipEntity)

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
                            durationMs={OUTLINE_DRAW_MS}
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
                        {displayEntityName(label.region)}
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
                        handlers={lineHandlers}
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

            {placedAnnotations.map(({ key, content, style }) => (
                <div
                    key={key}
                    className="income-distribution-chart__annotation"
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
