import * as _ from "lodash-es"
import * as R from "remeda"
import { Bounds, dyFromAlign, VerticalAlign } from "@ourworldindata/utils"
import { DualAxis } from "../axis/Axis"
import { ColorScaleBin } from "../color/ColorScaleBin"
import { TooltipState } from "../tooltip/Tooltip"
import { MarimekkoBarsForOneEntity } from "./MarimekkoBarsForOneEntity"
import { Item, PlacedItem } from "./MarimekkoChartConstants"
import { GRAPHER_FONT_SCALE_12, Patterns } from "../core/GrapherConstants"
import { SelectionArray } from "../selection/SelectionArray"

interface MarimekkoBarsProps {
    dualAxis: DualAxis
    focusColorBin?: ColorScaleBin
    placedItems: PlacedItem[]
    tooltipState?: TooltipState<{ entityName: string }>
    fontSize: number
    onEntityMouseOver?: (entityName: string, ev: React.MouseEvent) => void
    onEntityMouseLeave?: () => void
    onEntityClick?: (entityName: string) => void
    x0: number
    y0: number
    selectionArray: SelectionArray
    selectedItems: Item[]
    isFocusModeActive?: boolean
}

export function MarimekkoBars(props: MarimekkoBarsProps): React.ReactElement {
    const normalElements: React.ReactElement[] = []
    const highlightedElements: React.ReactElement[] = [] // highlighted elements have a thicker stroke and should be drawn last to overlap others
    const {
        dualAxis,
        focusColorBin,
        placedItems,
        tooltipState,
        fontSize,
        onEntityClick,
        onEntityMouseLeave,
        onEntityMouseOver,
        x0,
        y0,
        selectionArray,
        selectedItems,
        isFocusModeActive,
    } = props
    const selectionSet = selectionArray.selectedSet
    const labelYOffset = 0
    const hasSelection = selectedItems.length > 0
    let noDataAreaElement = undefined
    let noDataLabel = undefined
    const noDataHeight = Bounds.forText("no data").height + 10

    const firstNanValue = placedItems.findIndex((item) => !item.bars.length)
    const anyNonNanAfterFirstNan =
        firstNanValue >= 0
            ? placedItems
                  .slice(firstNanValue)
                  .some((item) => item.bars.length !== 0)
            : false

    if (anyNonNanAfterFirstNan)
        console.error("Found Non-NAN values after NAN value!")

    if (firstNanValue !== -1) {
        const firstNanValueItem = placedItems[firstNanValue]
        const lastItem = R.last(placedItems)!
        const noDataRangeStartX =
            firstNanValueItem.xPosition + dualAxis.horizontalAxis.place(x0)
        const xValue = lastItem.xPoint?.value ?? 1
        const noDataRangeEndX =
            lastItem?.xPosition + dualAxis.horizontalAxis.place(xValue)
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

    for (const item of placedItems) {
        const { entityName, bars, xPoint, entityColor } = item
        const currentX = dualAxis.horizontalAxis.place(x0) + item.xPosition

        const xValue = xPoint?.value ?? 1
        const barWidth =
            dualAxis.horizontalAxis.place(xValue) -
            dualAxis.horizontalAxis.place(x0)

        const isSelected = selectionSet.has(entityName)
        const isHovered =
            entityName === tooltipState?.target?.entityName &&
            !tooltipState.fading
        const isFaint =
            item.focus.background ||
            (focusColorBin !== undefined &&
                !focusColorBin.contains(entityColor?.colorDomainValue)) ||
            (hasSelection && !isSelected) ||
            (!isHovered &&
                tooltipState?.target !== undefined &&
                !tooltipState.fading)

        // figure out what the minimum height in domain space has to be so
        // that a bar is at least one pixel high in screen space.
        const yAxisOnePixelDomainEquivalent =
            dualAxis.verticalAxis.invert(dualAxis.verticalAxis.place(y0) - 1) -
            dualAxis.verticalAxis.invert(dualAxis.verticalAxis.place(y0))
        const adjustedBars = []
        let currentY = 0
        for (const bar of bars) {
            const barCopy = _.cloneDeep(bar)
            // we want to draw bars at least one pixel high so that they are guaranteed to have a
            // visual representation in our chart (as a 1px line in this case)
            barCopy.yPoint.value = Math.max(
                barCopy.yPoint.value,
                yAxisOnePixelDomainEquivalent
            )
            barCopy.yPoint.valueOffset = currentY
            currentY += barCopy.yPoint.value
            adjustedBars.push(barCopy)
        }

        const barsProps = {
            entityName,
            bars: adjustedBars,
            xPoint,
            entityColor,
            isFaint,
            isHovered,
            isSelected,
            focus: item.focus,
            barWidth,
            currentX,
            onEntityClick,
            onEntityMouseLeave,
            onEntityMouseOver,
            labelYOffset,
            y0,
            noDataHeight,
            dualAxis,
        }
        const result = (
            <MarimekkoBarsForOneEntity key={entityName} {...barsProps} />
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
