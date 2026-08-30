import * as R from "remeda"
import {
    Bounds,
    dyFromAlign,
    makeFigmaId,
    VerticalAlign,
} from "@ourworldindata/utils"
import { DualAxis } from "../axis/Axis"
import { ColorScaleBin } from "../color/ColorScaleBin"
import { TooltipState } from "../tooltip/Tooltip"
import {
    MarimekkoSeries,
    PlacedMarimekkoSeries,
} from "./MarimekkoChartConstants"
import { GRAPHER_FONT_SCALE_12, Patterns } from "../core/GrapherConstants"
import { SelectionArray } from "../selection/SelectionArray"
import { STACKED_BAR_STYLE } from "./StackedConstants.js"
import { Emphasis } from "../interaction/Emphasis.js"

interface MarimekkoBarsProps {
    dualAxis: DualAxis
    focusColorBin?: ColorScaleBin
    placedSeries: PlacedMarimekkoSeries[]
    tooltipState?: TooltipState<{ entityName: string }>
    fontSize: number
    onEntityMouseOver?: (entityName: string, ev: React.MouseEvent) => void
    onEntityMouseLeave?: () => void
    onEntityClick?: (entityName: string) => void
    x0: number
    y0: number
    selectionArray: SelectionArray
    selectedSeries: MarimekkoSeries[]
    isFocusModeActive?: boolean
}

export function MarimekkoBars(props: MarimekkoBarsProps): React.ReactElement {
    const normalElements: React.ReactElement[] = []
    const highlightedElements: React.ReactElement[] = [] // highlighted elements have a thicker stroke and should be drawn last to overlap others
    const {
        dualAxis,
        focusColorBin,
        placedSeries,
        tooltipState,
        fontSize,
        onEntityClick,
        onEntityMouseLeave,
        onEntityMouseOver,
        x0,
        y0,
        selectionArray,
        selectedSeries,
        isFocusModeActive,
    } = props
    const selectionSet = selectionArray.selectedSet
    const labelYOffset = 0
    const hasSelection = selectedSeries.length > 0
    let noDataAreaElement = undefined
    let noDataLabel = undefined
    const noDataHeight = Bounds.forText("no data").height + 10

    const firstNanValue = placedSeries.findIndex(
        (series) => series.yPoint === undefined
    )
    const anyNonNanAfterFirstNan =
        firstNanValue >= 0
            ? placedSeries
                  .slice(firstNanValue)
                  .some((series) => series.yPoint !== undefined)
            : false

    if (anyNonNanAfterFirstNan)
        console.error("Found Non-NAN values after NAN value!")

    if (firstNanValue !== -1) {
        const firstNanValueSeries = placedSeries[firstNanValue]
        const lastSeries = R.last(placedSeries)!
        const noDataRangeStartX =
            firstNanValueSeries.xPosition + dualAxis.horizontalAxis.place(x0)
        const xValue = lastSeries.xPoint?.value ?? 1
        const noDataRangeEndX =
            lastSeries?.xPosition + dualAxis.horizontalAxis.place(xValue)
        const yStart = dualAxis.verticalAxis.place(y0)

        const noDataLabelX =
            noDataRangeStartX + (noDataRangeEndX - noDataRangeStartX) / 2
        const boundsForNoData = Bounds.forText("no data")
        const noDataLabelY = yStart - boundsForNoData.width
        noDataLabel = (
            <text
                key={`noDataArea-label`}
                x={0}
                transform={`rotate(-90, ${noDataLabelX}, ${noDataLabelY})
                translate(${noDataLabelX}, ${noDataLabelY})`}
                y={0}
                width={noDataRangeEndX - noDataRangeStartX}
                height={noDataHeight}
                fontWeight={700}
                fill="#666"
                opacity={1}
                fontSize={GRAPHER_FONT_SCALE_12 * fontSize}
                textAnchor="middle"
                dy={dyFromAlign(VerticalAlign.middle)}
                style={{ pointerEvents: "none" }}
            >
                no data
            </text>
        )

        noDataAreaElement = (
            <rect
                key="noDataArea"
                x={noDataRangeStartX}
                y={yStart - noDataHeight}
                width={noDataRangeEndX - noDataRangeStartX}
                height={noDataHeight}
                fill={`url(#${Patterns.noDataPattern})`}
                opacity={0.5}
            ></rect>
        )
    }

    for (const series of placedSeries) {
        const { entityName, xPoint, entityColor } = series
        const currentX = dualAxis.horizontalAxis.place(x0) + series.xPosition

        const xValue = xPoint?.value ?? 1
        const barWidth =
            dualAxis.horizontalAxis.place(xValue) -
            dualAxis.horizontalAxis.place(x0)

        const isSelected = selectionSet.has(entityName)
        const isHovered =
            entityName === tooltipState?.target?.entityName &&
            !tooltipState.fading
        const isFaint =
            series.focus.background ||
            (focusColorBin !== undefined &&
                !focusColorBin.contains(entityColor?.colorDomainValue)) ||
            (focusColorBin === undefined && hasSelection && !isSelected) ||
            (!isHovered &&
                !isSelected &&
                tooltipState?.target !== undefined &&
                !tooltipState.fading)

        const result = (
            <MarimekkoBar
                key={entityName}
                series={series}
                barWidth={barWidth}
                currentX={currentX}
                labelYOffset={labelYOffset}
                isHovered={isHovered}
                isSelected={isSelected}
                isFaint={isFaint}
                y0={y0}
                noDataHeight={noDataHeight}
                dualAxis={dualAxis}
                onEntityClick={onEntityClick}
                onEntityMouseLeave={onEntityMouseLeave}
                onEntityMouseOver={onEntityMouseOver}
            />
        )
        if (isSelected || isHovered) highlightedElements.push(result)
        else normalElements.push(result)
    }

    return (
        <>
            {noDataAreaElement}
            {normalElements}
            {highlightedElements}
            {!isFocusModeActive && noDataLabel}
        </>
    )
}

interface MarimekkoBarProps {
    series: PlacedMarimekkoSeries
    barWidth: number
    currentX: number
    labelYOffset: number
    isHovered: boolean
    isSelected: boolean
    isFaint: boolean
    y0: number
    noDataHeight: number
    dualAxis: DualAxis
    onEntityMouseOver?: (entityName: string, ev: React.MouseEvent) => void
    onEntityMouseLeave?: () => void
    onEntityClick?: (entityName: string) => void
}

function MarimekkoBar({
    series,
    barWidth,
    currentX,
    labelYOffset,
    isHovered,
    isSelected,
    isFaint,
    y0,
    noDataHeight,
    dualAxis,
    onEntityClick,
    onEntityMouseLeave,
    onEntityMouseOver,
}: MarimekkoBarProps): React.ReactElement {
    const { entityName, yPoint, focus } = series
    const isPlaceholder = yPoint === undefined

    const barColor = focus.background
        ? "#DADADA"
        : isPlaceholder
          ? "#555"
          : series.color
    const strokeWidth = isHovered || isSelected ? 1 : 0.5
    const strokeOpacity = isPlaceholder ? 0.8 : isFaint ? 0.2 : 1.0
    const fillOpacity = isHovered
        ? STACKED_BAR_STYLE[Emphasis.Highlighted].opacity
        : isFaint
          ? STACKED_BAR_STYLE[Emphasis.Muted].opacity
          : isSelected
            ? isPlaceholder
                ? 0.3
                : STACKED_BAR_STYLE[Emphasis.Default].opacity
            : STACKED_BAR_STYLE[Emphasis.Default].opacity
    const overalOpacity = isPlaceholder ? 0.2 : 1.0

    const barY = dualAxis.verticalAxis.place(y0)
    let barHeight: number
    if (yPoint !== undefined) {
        // figure out what the minimum height in domain space has to be so
        // that a bar is at least one pixel high in screen space.
        const yAxisOnePixelDomainEquivalent =
            dualAxis.verticalAxis.invert(dualAxis.verticalAxis.place(y0) - 1) -
            dualAxis.verticalAxis.invert(dualAxis.verticalAxis.place(y0))
        // we want to draw bars at least one pixel high so that they are guaranteed to have a
        // visual representation in our chart (as a 1px line in this case)
        const value = Math.max(yPoint.value, yAxisOnePixelDomainEquivalent)
        barHeight = barY - dualAxis.verticalAxis.place(value)
    } else {
        barHeight = noDataHeight
    }

    return (
        <g
            id={makeFigmaId("bar", entityName)}
            className="bar"
            transform={`translate(${currentX}, ${labelYOffset})`}
            onMouseOver={(ev): void => onEntityMouseOver?.(entityName, ev)}
            onMouseLeave={(): void => onEntityMouseLeave?.()}
            onClick={(): void => onEntityClick?.(entityName)}
        >
            <g>
                <rect
                    x={0}
                    y={0}
                    transform={`translate(0, ${barY - barHeight})`}
                    width={barWidth}
                    height={barHeight}
                    fill={barColor}
                    fillOpacity={fillOpacity}
                    stroke={barColor}
                    strokeWidth={strokeWidth}
                    strokeOpacity={strokeOpacity}
                    opacity={overalOpacity}
                    style={{ transition: "translate 200ms ease" }}
                />
            </g>
        </g>
    )
}
