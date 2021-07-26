import * as React from "react"
import {
    min,
    max,
    maxBy,
    last,
    flatten,
    excludeUndefined,
    sortBy,
    sumBy,
    sum,
    minBy,
} from "../../clientUtils/Util"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds"
import {
    BASE_FONT_SIZE,
    EntitySelectionMode,
    SeriesName,
} from "../core/GrapherConstants"
import { DualAxisComponent } from "../axis/AxisViews"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { AxisConfig } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import { OwidTable } from "../../coreTable/OwidTable"
import { autoDetectYColumnSlugs, makeSelectionArray } from "../chart/ChartUtils"
import { stackSeries } from "./StackedUtils"
import { ChartManager } from "../chart/ChartManager"
import { Color, Time } from "../../clientUtils/owidTypes"
import { StackedPoint, StackedSeries } from "./StackedConstants"
import { ColorSchemes } from "../color/ColorSchemes"
import {
    EntityId,
    EntityName,
    LegacyOwidRow,
    OwidTableSlugs,
} from "../../coreTable/OwidTableConstants"
import {
    LegendAlign,
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
} from "../horizontalColorLegend/HorizontalColorLegends"
import { CategoricalBin } from "../color/ColorScaleBin"
import { CoreColumn } from "../../coreTable/CoreTableColumns"
import { TippyIfInteractive } from "../chart/Tippy"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons/faInfoCircle"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import {
    ColorScaleConfig,
    ColorScaleConfigDefaults,
} from "../color/ColorScaleConfig"
import { ColorSchemeName } from "../color/ColorConstants"
import { color } from "d3-color"
import { SelectionArray } from "../selection/SelectionArray"
import { ColorScheme } from "../color/ColorScheme"
import { CoreRow } from "../../coreTable/CoreTableConstants"
import _ from "lodash"

export interface MarimekkoChartManager extends ChartManager {
    endTime?: Time
    excludedEntities?: EntityId[]
    matchingEntitiesOnly?: boolean
}

interface EntityColorData {
    color: Color
    colorDomainValue: string
}
// Points used on the X axis
interface SimplePoint {
    value: number
    entity: string
    time: number
}

export interface SimpleChartSeries {
    seriesName: string
    points: SimplePoint[]
}

enum BarShape {
    Bar,
    BarPlaceholder,
}

interface Bar {
    kind: BarShape.Bar
    color: Color // color from the variable
    seriesName: string
    yPoint: StackedPoint<EntityName>
}

interface BarPlaceholder {
    kind: BarShape.BarPlaceholder
    seriesName: string
}

type BarOrPlaceholder = Bar | BarPlaceholder

interface Item {
    entityId: string
    entityColor: EntityColorData | undefined
    bars: Bar[] // contains the y values for every y variable
    xPoint: SimplePoint // contains the single x value
}

interface PlacedItem extends Item {
    pixelSpaceXOffset: number // x value (in pixel space) when placed in final sorted order and including shifts due to one pixel entity minimum
}

interface TooltipProps {
    item: Item
    highlightedSeriesName?: string
    targetTime?: Time
    timeColumn: CoreColumn
    formatColumn: CoreColumn
    xAxisColumn: CoreColumn
}

interface EntityWithSize {
    entityId: string
    xValue: number
}
interface LabelCandidate {
    item: EntityWithSize
    bounds: Bounds
    isPicked: boolean
    isSelected: boolean
}

interface LabelWithPlacement {
    label: JSX.Element
    preferredPlacement: number
    correctedPlacement: number
    labelKey: string
}

interface LabelCandidateWithElement {
    candidate: LabelCandidate
    labelElement: JSX.Element
}

const MARKER_MARGIN: number = 4
const MARKER_AREA_HEIGHT: number = 25

@observer
export class MarimekkoChart
    extends React.Component<{
        bounds?: Bounds
        manager: MarimekkoChartManager
    }>
    implements ChartInterface, HorizontalColorLegendManager, ColorScaleManager {
    base: React.RefObject<SVGGElement> = React.createRef()

    defaultBaseColorScheme = ColorSchemeName.continents
    defaultNoDataColor = "#959595"
    labelAngleInDegrees = -45 // 0 is horizontal, -90 is vertical from bottom to top, ...

    transformTable(table: OwidTable): OwidTable {
        if (!this.yColumnSlugs.length) return table
        if (!this.xColumnSlug) return table
        const { excludedEntities } = this.manager
        const { yColumnSlugs, manager, colorColumnSlug, xColumnSlug } = this

        if (excludedEntities) {
            const excludedEntityIdsSet = new Set(excludedEntities)
            table = table.columnFilter(
                OwidTableSlugs.entityId,
                (entityId) => !excludedEntityIdsSet.has(entityId as number),
                `Excluded entity ids specified by author: ${excludedEntities.join(
                    ", "
                )}`
            )
        }

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        yColumnSlugs.forEach((slug) => {
            table = table.interpolateColumnWithTolerance(slug)
        })

        table = table.interpolateColumnWithTolerance(xColumnSlug)
        table = table.dropRowsWithErrorValuesForAnyColumn([xColumnSlug])

        if (manager.isRelativeMode) {
            table = table.toPercentageFromEachEntityForEachTime(
                this.xColumnSlug
            )
        }

        if (colorColumnSlug) {
            const tolerance =
                table.get(colorColumnSlug)?.display?.tolerance ?? Infinity
            table = table.interpolateColumnWithTolerance(
                colorColumnSlug,
                tolerance
            )
            if (this.manager.matchingEntitiesOnly) {
                table = table.dropRowsWithErrorValuesForColumn(colorColumnSlug)
            }
        }
        return table
    }

    @observable private hoveredEntityName?: string

    @computed get entityNameSlug(): string {
        return "entityName"
    }

    @observable focusSeriesName?: SeriesName

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed get transformedTable(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed private get manager(): MarimekkoChartManager {
        return this.props.manager
    }

    @computed private get bounds(): Bounds {
        return (this.props.bounds ?? DEFAULT_BOUNDS).padRight(10)
    }

    @computed private get baseFontSize(): number {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed private get labelStyle(): {
        fontSize: number
        fontWeight: number
    } {
        return {
            fontSize: 0.75 * this.baseFontSize,
            fontWeight: 700,
        }
    }

    // Account for the width of the legend
    @computed private get labelWidth(): number {
        const labels = this.sortedItems.map((item) => item.entityId)
        const longestLabel = maxBy(labels, (d) => d.length)
        return Bounds.forText(longestLabel, this.labelStyle).width
    }

    @computed private get x0(): number {
        return 0
    }

    @computed private get y0(): number {
        return 0
    }

    @computed private get allPoints(): StackedPoint<EntityName>[] {
        return flatten(this.series.map((series) => series.points))
    }

    @computed private get yDomainDefault(): [number, number] {
        const maxValues = this.allPoints.map(
            (point) => point.value + point.valueOffset
        )
        return [
            Math.min(this.y0, min(maxValues) as number),
            Math.max(this.y0, max(maxValues) as number),
        ]
    }

    @computed private get onePixelThresholdAndCorrectionFactor(): {
        onePixelDomainValueEquivalent: number
        xDomainCorrectionFactor: number
    } {
        // Rounding up every country so that it is at least one pixel wide
        // on the X axis has a pretty annoying side effect: since there are
        // quite a few very small countries that get rounded up, the normal
        // placing on the X axis ends up overshooting the naive domain max value
        // by quite a bit.
        // Correcting for this naively is a simple job of calculating the domain
        // amount of one pixel, counting the countries below that and adjusting by
        // a simple factor. BUT this would now make the normal placement on the x
        // axis map the value we calculated above of "one pixel worth of domain amount"
        // to *slightly less* than one pixel, screwing up the rounding to pixel borders
        // that is required to avoid SVG hairline artifacts.
        // Instead what we do below is sort all x axis values ascending and then
        // continously adjusting the one pixel domain threshold value. This way we make sure
        // that in the final placement everything fits. In other words, what we are
        // doing is that we count all entities that would be less than one pixel WHILE
        // updating this threshold to take into account that the "normal" range gets
        // smaller by one pixel whenever we enlarge one small country to one pixel.

        const { xSeries } = this

        if (!xSeries.points.length)
            return {
                onePixelDomainValueEquivalent: 0,
                xDomainCorrectionFactor: 1,
            }

        console.log("Num points", xSeries.points.length)
        console.log("Range size", this.dualAxis.horizontalAxis.rangeSize)
        console.log("Range", this.dualAxis.horizontalAxis.range)

        const points = xSeries.points
            .map((point) => point.value)
            .sort((a, b) => a - b)
        const total = sum(points)
        const widthInPixels = this.dualAxis.horizontalAxis.rangeSize
        console.log("total", total)
        console.log("naive one pixel", total / widthInPixels)
        let onePixelDomainValueEquivalent = total / widthInPixels
        let numCountriesBelowOnePixel = 0
        let sumToRemoveFromTotal = 0
        for (let i = 0; i < points.length; i++) {
            if (points[i] >= onePixelDomainValueEquivalent) break
            numCountriesBelowOnePixel++
            sumToRemoveFromTotal += points[i]
            onePixelDomainValueEquivalent =
                (total - sumToRemoveFromTotal) /
                (widthInPixels - numCountriesBelowOnePixel)
        }
        const xDomainCorrectionFactor =
            (total - numCountriesBelowOnePixel * (total / widthInPixels)) /
            (total - sumToRemoveFromTotal)
        //(widthInPixels - numCountriesBelowOnePixel) / widthInPixels
        //(total - sumToRemoveFromTotal) / total
        console.log(
            "One pixel domain value equiv",
            onePixelDomainValueEquivalent
        )
        console.log("Correction factor", xDomainCorrectionFactor)
        return { onePixelDomainValueEquivalent, xDomainCorrectionFactor }
    }

    @computed private get onePixelDomainValueEquivalent(): number {
        return this.onePixelThresholdAndCorrectionFactor
            .onePixelDomainValueEquivalent
    }

    @computed private get xDomainCorrectionFactor(): number {
        return this.onePixelThresholdAndCorrectionFactor.xDomainCorrectionFactor
    }

    @computed private get xDomainDefault(): [number, number] {
        const sum = sumBy(this.xSeries.points, (point) => point.value)

        return [0, sum]
    }

    @computed private get yRange(): [number, number] {
        return [
            this.bounds.top - this.legend.height,
            this.bounds.bottom - this.labelWidth,
        ]
    }

    @computed private get xRange(): [number, number] {
        return [this.bounds.left, this.bounds.right]
    }

    @computed private get yAxisPart(): AxisConfig {
        return this.manager.yAxis || new AxisConfig()
    }

    @computed private get xAxisPart(): AxisConfig {
        return this.manager.xAxis || new AxisConfig()
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        const axis = this.yAxisPart.toVerticalAxis()
        axis.updateDomainPreservingUserSettings(this.yDomainDefault)

        axis.formatColumn = this.yColumns[0]
        axis.range = this.yRange
        axis.label = ""
        return axis
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        const axis = this.xAxisPart.toHorizontalAxis()
        if (this.manager.isRelativeMode) axis.domain = [0, 100]
        else axis.updateDomainPreservingUserSettings(this.xDomainDefault)

        axis.formatColumn = this.xColumn
        axis.range = this.xRange
        axis.label = ""
        return axis
    }

    @computed private get dualAxis(): DualAxis {
        const whiteSpaceOnLeft = this.bounds.left + this.verticalAxisPart.width
        const marginToEnsureWidestEntityLabelFitsEvenIfAtX0 =
            Math.max(whiteSpaceOnLeft, this.longestLabelWidth) -
            whiteSpaceOnLeft
        return new DualAxis({
            bounds: this.bounds
                .padBottom(this.longestLabelHeight)
                .padTop(
                    this.legend.height + this.horizontalAxisPart.labelFontSize
                )
                .padLeft(marginToEnsureWidestEntityLabelFitsEvenIfAtX0),
            verticalAxis: this.verticalAxisPart,
            horizontalAxis: this.horizontalAxisPart,
        })
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager)
    }

    @computed private get selectedItems(): Item[] {
        const selectedSet = this.selectionArray.selectedSet
        const { sortedItems } = this
        if (selectedSet.size === 0) return []
        return sortedItems.filter((item) => selectedSet.has(item.entityId))
    }

    @computed private get sortedItems(): Item[] {
        const hasColorColumn = !this.colorColumn.isMissing
        const entityNames = this.xColumn.uniqEntityNames
        const { xSeries, colorColumn, colorScale, series } = this

        const items: Item[] = entityNames
            .map((entityName) => {
                const xPoint = xSeries.points.find(
                    (point) => point.entity === entityName
                )
                if (!xPoint) return undefined

                const colorRowsByEntity = hasColorColumn
                    ? colorColumn.owidRowsByEntityName
                    : undefined
                const colorDomainValue = colorRowsByEntity?.get(entityName)?.[0]

                const color = colorDomainValue
                    ? colorScale.getColor(colorDomainValue.value)
                    : undefined

                return {
                    entityId: entityName,
                    xPoint: xPoint,
                    entityColor: color
                        ? { colorDomainValue: colorDomainValue?.value, color }
                        : undefined,
                    bars: excludeUndefined(
                        series.map((series): Bar | undefined => {
                            const point = series.points.find(
                                (point) => point.position === entityName
                            )
                            if (!point) return undefined
                            return {
                                kind: BarShape.Bar,
                                yPoint: point,
                                color: series.color,
                                seriesName: series.seriesName,
                            }
                        })
                    ),
                }
            })
            .filter((item) => item) as Item[]

        const sorted = sortBy(items, (item) => {
            const lastPoint = last(item.bars)?.yPoint
            if (!lastPoint) return -Infinity
            return lastPoint.valueOffset + lastPoint.value
        }).reverse()

        return sorted
    }

    @computed get placedItems(): PlacedItem[] {
        const { sortedItems, dualAxis, x0, xDomainCorrectionFactor } = this
        const placedItems: PlacedItem[] = []
        let currentX = 0
        for (const item of sortedItems) {
            placedItems.push({ ...item, pixelSpaceXOffset: currentX })
            currentX += Math.max(
                1,
                dualAxis.horizontalAxis.place(
                    item.xPoint.value * xDomainCorrectionFactor
                ) - dualAxis.horizontalAxis.place(x0)
            )
        }
        return placedItems
    }

    @computed get placedItemsMap(): Map<string, PlacedItem> {
        return new Map(this.placedItems.map((item) => [item.entityId, item]))
    }

    // legend props

    @computed get legendPaddingTop(): number {
        return 0
    }

    @computed get legendX(): number {
        return this.bounds.x
    }

    @computed get categoryLegendY(): number {
        return 0
    }

    @computed get legendWidth(): number {
        return this.bounds.width
    }

    @computed get legendAlign(): LegendAlign {
        return LegendAlign.left
    }

    @computed get fontSize(): number {
        return this.baseFontSize
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        const { colorColumnSlug, colorScale, series } = this
        if (colorColumnSlug) return colorScale.categoricalLegendBins
        else
            return series.map((series, index) => {
                return new CategoricalBin({
                    index,
                    value: series.seriesName,
                    label: series.seriesName,
                    color: series.color,
                })
            })
    }

    @action.bound onLegendMouseOver(bin: CategoricalBin): void {
        this.focusSeriesName = bin.value
    }

    @action.bound onLegendMouseLeave(): void {
        this.focusSeriesName = undefined
    }

    @computed private get legend(): HorizontalCategoricalColorLegend {
        return new HorizontalCategoricalColorLegend({ manager: this })
    }

    @computed private get formatColumn(): CoreColumn {
        return this.yColumns[0]
    }

    @action.bound private onEntityMouseOver(entityName: string): void {
        this.hoveredEntityName = entityName
    }

    @action.bound private onEntityMouseLeave(): void {
        this.hoveredEntityName = undefined
    }

    @action.bound private onEntityClick(entityName: string): void {
        this.onSelectEntity(entityName)
    }

    @action.bound private onSelectEntity(entityName: string): void {
        if (this.canAddCountry) this.selectionArray.toggleSelection(entityName)
    }
    @computed private get canAddCountry(): boolean {
        const { addCountryMode } = this.manager
        return (addCountryMode &&
            addCountryMode !== EntitySelectionMode.Disabled) as boolean
    }

    render(): JSX.Element {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        const { bounds, dualAxis } = this

        return (
            <g ref={this.base} className="MarimekkoChart">
                <rect
                    x={bounds.left}
                    y={bounds.top}
                    width={bounds.width}
                    height={bounds.height}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                <DualAxisComponent
                    dualAxis={dualAxis}
                    showTickMarks={true}
                    horizontalAxisLabelsOnTop={true}
                />
                <HorizontalCategoricalColorLegend manager={this} />
                {this.renderBars()}
            </g>
        )
    }

    private renderBars(): JSX.Element[] {
        const normalElements: JSX.Element[] = []
        const highlightedElements: JSX.Element[] = [] // highlighted elements have a thicker stroke and should be drawn last to overlap others
        const {
            dualAxis,
            x0,
            xDomainCorrectionFactor,
            focusSeriesName,
            placedLabels,
            labelLines,
        } = this
        const selectionSet = this.selectionArray.selectedSet
        const targetTime = this.manager.endTime
        const timeColumn = this.inputTable.timeColumn
        const formatColumn = this.formatColumn
        const xAxisColumn = this.xColumn
        const labelYOffset = 0
        let noDataAreaElement = undefined
        let noDataLabel = undefined
        const debugLines: JSX.Element[] = []

        const firstNanValue = this.placedItems.findIndex(
            (item) => !item.bars.length
        )
        const anyNonNanAfterFirstNan =
            firstNanValue >= 0
                ? _(this.placedItems)
                      .drop(firstNanValue)
                      .some((item) => item.bars.length !== 0)
                : false

        if (anyNonNanAfterFirstNan)
            console.error("Found Non-NAN values after NAN value!")

        if (firstNanValue !== -1) {
            const firstNanValueItem = this.placedItems[firstNanValue]
            const lastItem = _.last(this.placedItems)!
            const noDataRangeStartX =
                firstNanValueItem.pixelSpaceXOffset +
                dualAxis.horizontalAxis.place(x0)
            const noDataRangeEndX =
                lastItem?.pixelSpaceXOffset +
                dualAxis.horizontalAxis.place(lastItem.xPoint.value)
            const yStart = dualAxis.verticalAxis.place(this.y0)
            const height = dualAxis.verticalAxis.rangeSize
            noDataAreaElement = (
                <rect
                    key="noDataArea"
                    x={noDataRangeStartX}
                    y={yStart - height}
                    //transform={`translate(${barX}, ${barY - barHeight})`}
                    width={noDataRangeEndX - noDataRangeStartX}
                    height={height}
                    fill={"#ccc"}
                    // stroke={strokeColor}
                    // strokeWidth={strokeWidth}
                    opacity={0.5}
                ></rect>
            )

            noDataLabel = (
                <text
                    key={`noDataArea-label`}
                    x={
                        noDataRangeStartX +
                        (noDataRangeEndX - noDataRangeStartX) / 2
                    }
                    y={yStart - height / 2}
                    width={noDataRangeEndX - noDataRangeStartX}
                    height={height}
                    fontWeight={300}
                    fill="#000"
                    opacity={1}
                    fontSize="1em"
                    textAnchor="middle"
                    dominantBaseline="middle"
                >
                    no data
                </text>
            )

            console.log("domain", this.xDomainDefault)
            // debugLines.push(
            //         <path
            //             d={`M${},${markerBarEndpointY} V${markerTextEndpointY}`}
            //             stroke={lineColor}
            //             strokeWidth={1}
            //             fill="none"
            //         />)
        }

        for (const item of this.placedItems) {
            const { entityId, bars, xPoint, entityColor } = item
            const currentX =
                dualAxis.horizontalAxis.place(x0) + item.pixelSpaceXOffset
            const tooltipProps = {
                item,
                targetTime,
                timeColumn,
                formatColumn,
                xAxisColumn,
            }

            const exactWidth =
                dualAxis.horizontalAxis.place(
                    xPoint.value * xDomainCorrectionFactor
                ) - dualAxis.horizontalAxis.place(x0)
            const correctedWidth = exactWidth
            const barWidth = correctedWidth > 1 ? correctedWidth : 1

            const isSelected = selectionSet.has(entityId)
            const isHovered = entityId === this.hoveredEntityName
            const isFaint =
                focusSeriesName !== undefined &&
                entityColor?.colorDomainValue !== focusSeriesName
            const result = (
                <g
                    key={entityId}
                    className="bar"
                    transform={`translate(${currentX}, ${labelYOffset})`}
                    onMouseOver={(): void => this.onEntityMouseOver(entityId)}
                    onMouseLeave={(): void => this.onEntityMouseLeave()}
                    onClick={(): void => this.onEntityClick(entityId)}
                >
                    {bars.length
                        ? bars.map((bar) => {
                              return this.renderBar(
                                  bar,
                                  {
                                      ...tooltipProps,
                                      highlightedSeriesName: bar.seriesName,
                                  },
                                  barWidth,
                                  isHovered,
                                  isSelected,
                                  isFaint,
                                  entityColor?.color
                              )
                          })
                        : this.renderBar(
                              {
                                  kind: BarShape.BarPlaceholder,
                                  seriesName: entityId,
                              },
                              {
                                  ...tooltipProps,
                                  highlightedSeriesName: "",
                              },
                              barWidth,
                              isHovered,
                              isSelected,
                              isFaint,
                              entityColor?.color
                          )}
                </g>
            )
            if (isSelected || isHovered) highlightedElements.push(result)
            else normalElements.push(result)
        }

        return _.concat(
            noDataAreaElement ? [noDataAreaElement] : [],
            normalElements,
            placedLabels,
            labelLines,
            highlightedElements,
            debugLines,
            noDataLabel ? [noDataLabel] : []
        )
    }
    private paddingInPixels = 5

    private renderBar(
        bar: BarOrPlaceholder,
        tooltipProps: TooltipProps,
        barWidth: number,
        isHovered: boolean,
        isSelected: boolean,
        isFaint: boolean,
        entityColor: string | undefined
    ): JSX.Element {
        const { dualAxis, manager } = this
        const { seriesName } = bar
        const isPlaceholder = bar.kind === BarShape.BarPlaceholder
        const barBaseColor =
            entityColor ?? (bar.kind === BarShape.Bar ? bar.color : "#555")

        const barColor =
            bar.kind === BarShape.BarPlaceholder
                ? "#555"
                : isHovered
                ? color(barBaseColor)?.brighter(0.9).toString() ?? barBaseColor
                : isSelected
                ? color(barBaseColor)?.brighter(0.6).toString() ?? barBaseColor
                : barBaseColor
        const strokeColor =
            isHovered || isSelected ? "#555" : isPlaceholder ? "#aaa" : "#666"
        const strokeWidth = isHovered || isSelected ? "1px" : "0.5px"

        let barY: number = 0
        let barHeight: number = 0
        if (bar.kind === BarShape.Bar) {
            barY = dualAxis.verticalAxis.place(this.y0 + bar.yPoint.valueOffset)
            barHeight =
                dualAxis.verticalAxis.place(this.y0) -
                dualAxis.verticalAxis.place(bar.yPoint.value)
        } else {
            barY = dualAxis.verticalAxis.place(this.y0)
            barHeight = dualAxis.verticalAxis.rangeSize
        }
        const barX = 0

        return (
            <TippyIfInteractive
                lazy
                isInteractive={!manager.isExportingtoSvgOrPng}
                key={seriesName}
                hideOnClick={false}
                content={<MarimekkoChart.Tooltip {...tooltipProps} />}
            >
                <g>
                    <rect
                        x={0}
                        y={0}
                        transform={`translate(${barX}, ${barY - barHeight})`}
                        width={barWidth}
                        height={barHeight}
                        fill={barColor}
                        fillOpacity={isPlaceholder ? 0.0 : 1.0}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        opacity={
                            isFaint ? 0.1 : isSelected || isHovered ? 0.85 : 0.6
                        }
                        style={{
                            transition: "translate 200ms ease",
                        }}
                    />
                </g>
            </TippyIfInteractive>
        )
    }

    private static labelCanidateFromItem(
        item: EntityWithSize,
        baseFontSize: number,
        isSelected: boolean
    ): LabelCandidate {
        return {
            item: item,
            bounds: Bounds.forText(item.entityId, {
                fontSize: 0.7 * baseFontSize,
            }),
            isPicked: isSelected,
            isSelected,
        }
    }
    private static splitIntoEqualDomainSizeChunks(
        candidates: LabelCandidate[],
        numChunks: number
    ): LabelCandidate[][] {
        const chunks: LabelCandidate[][] = []
        let currentChunk: LabelCandidate[] = []
        let domainSizeOfChunk = 0
        const domainSizeThreshold = Math.ceil(
            sumBy(candidates, (candidate) => candidate.item.xValue) / numChunks
        )
        for (const candidate of candidates) {
            while (domainSizeOfChunk > domainSizeThreshold) {
                chunks.push(currentChunk)
                currentChunk = []
                domainSizeOfChunk -= domainSizeThreshold
            }
            domainSizeOfChunk += candidate.item.xValue
            currentChunk.push(candidate)
        }
        chunks.push(currentChunk)

        return chunks.filter((chunk) => chunk.length > 0)
    }

    @computed private get pickedLabelCandidates(): LabelCandidate[] {
        const { xColumnFullTimeRange, selectedItems, xRange } = this
        const xRowsByEntity = xColumnFullTimeRange.owidRowsByEntityName
        const lastYearOfEachEntity: Map<string, CoreRow> = new Map()

        for (const [entity, rows] of xRowsByEntity.entries()) {
            const row = minBy(rows, (row) => row.time) //last( rows.sort((a: CoreRow, b: CoreRow) => a.time - b.time))
            if (row) lastYearOfEachEntity.set(entity, row)
        }
        if (!lastYearOfEachEntity.size) return []
        // Measure the labels (before any rotation, just normal horizontal labels)
        const selectedItemsSet = new Set(
            selectedItems.map((item) => item.entityId)
        )

        const labelCandidates: LabelCandidate[] = [
            ...lastYearOfEachEntity.entries(),
        ].map(([entity, row]) =>
            MarimekkoChart.labelCanidateFromItem(
                { entityId: entity, xValue: row.value },
                this.baseFontSize,
                selectedItemsSet.has(entity)
            )
        )

        const labelHeight = labelCandidates[0].bounds.height
        // Always pick the first and last element
        labelCandidates[0].isPicked = true
        labelCandidates[labelCandidates.length - 1].isPicked = true
        const availablePixels = xRange[1] - xRange[0]

        const numLabelsToAdd = Math.floor(
            (availablePixels / (labelHeight + this.paddingInPixels)) * 0.7
        )
        const chunks = MarimekkoChart.splitIntoEqualDomainSizeChunks(
            labelCandidates,
            numLabelsToAdd
        )
        const picks = chunks.flatMap((chunk) => {
            const picked = chunk.filter((candidate) => candidate.isPicked)
            if (picked.length > 0) return picked
            else {
                return maxBy(chunk, (candidate) => candidate.item.xValue)
            }
        })
        // for (const max of picks) {
        //     if (max) max.isPicked = true
        // }
        const picked = labelCandidates.filter((candidate) => candidate.isPicked)

        return picked
    }

    @computed private get labelsWithPlacementInfo(): LabelWithPlacement[] {
        const {
            dualAxis,
            x0,
            xDomainCorrectionFactor,
            manager,
            placedItemsMap,
        } = this
        const targetTime = this.manager.endTime
        const timeColumn = this.inputTable.timeColumn
        const formatColumn = this.formatColumn
        const xAxisColumn = this.xColumn
        const labelsYPosition = dualAxis.verticalAxis.place(0)

        const labelsWithPlacements: LabelWithPlacement[] = this.labels
            .map(({ candidate, labelElement }) => {
                const xPoint = candidate.item.xValue
                const exactWidth =
                    dualAxis.horizontalAxis.place(
                        xPoint * xDomainCorrectionFactor
                    ) - dualAxis.horizontalAxis.place(x0)
                const correctedWidth = exactWidth
                const barWidth = correctedWidth > 1 ? correctedWidth : 1
                const labelId = candidate.item.entityId
                const item = placedItemsMap.get(candidate.item.entityId)
                if (!item) {
                    console.error(
                        "Could not find item",
                        candidate.item.entityId
                    )
                    return null
                } else {
                    const tooltipProps = {
                        item,
                        targetTime,
                        timeColumn,
                        formatColumn,
                        xAxisColumn,
                    }
                    const currentX =
                        dualAxis.horizontalAxis.place(x0) +
                        item.pixelSpaceXOffset
                    const labelWithPlacement = {
                        label: (
                            <g
                                transform={`translate(${0}, ${labelsYPosition})`}
                            >
                                <TippyIfInteractive
                                    lazy
                                    isInteractive={
                                        !manager.isExportingtoSvgOrPng
                                    }
                                    key={labelId}
                                    hideOnClick={false}
                                    content={
                                        <MarimekkoChart.Tooltip
                                            {...tooltipProps}
                                        />
                                    }
                                >
                                    {labelElement}
                                </TippyIfInteractive>
                            </g>
                        ),
                        preferredPlacement: currentX + barWidth,
                        correctedPlacement: currentX + barWidth,
                        labelKey: labelId,
                    }
                    if (labelWithPlacement.labelKey === "China")
                        console.log("China", labelWithPlacement)
                    return labelWithPlacement
                }
            })
            .filter(
                (item: LabelWithPlacement | null): item is LabelWithPlacement =>
                    item !== null
            )

        // This collision detection code is optimized for the particular
        // case of distributing items in 1D, knowing that we picked a low
        // enough number of labels that we will be able to fit all labels.
        // The algorithm iterates the list twice, i.e. works in linear time
        // with the number of labels to show
        // The logic in pseudo code:
        // for current, next in iterate-left-to-right-pairs:
        //   if next.x < current.x + label-width:
        //      next.x = current.x + label-width
        // last.x = Math.min(last.x, max-x)
        // for current, prev in iterate-right-to-left-pairs:
        //   if prev.x > current.x - label-width:
        //      prev.x = current.x - label-width

        // The label width is uniform for now and starts with
        // the height of a label when printed in normal horizontal layout
        // Since labels are rotated we need to make a bit more space so that they
        // stack correctly. Consider:
        //     ╱---╱ ╱---╱
        //    ╱   ╱ ╱   ╱
        //   ╱   ╱ ╱   ╱
        //  ╱---╱ ╱---╱
        // If we would just use exactly the label width then the flatter the angle
        // the more they would actually overlap so we need a correction factor. It turns
        // out than tan(angle) is the correction factor we want, although for horizontal
        // labels we don't want to use +infinity :) so we Math.min it with the longest label width

        labelsWithPlacements.sort(
            (a, b) => a.preferredPlacement - b.preferredPlacement
        )

        const labelWidth = this.unrotatedHighestLabelHeight
        const correctionFactor =
            1 +
            Math.min(
                this.unrotatedLongestLabelWidth / labelWidth,
                Math.abs(Math.tan(this.labelAngleInDegrees))
            )
        const correctedLabelWidth = labelWidth * correctionFactor

        for (let i = 0; i < labelsWithPlacements.length - 1; i++) {
            const current = labelsWithPlacements[i]
            const next = labelsWithPlacements[i + 1]
            const minNextX = current.correctedPlacement + correctedLabelWidth
            if (next.correctedPlacement < minNextX)
                next.correctedPlacement = minNextX
        }
        labelsWithPlacements[
            labelsWithPlacements.length - 1
        ].correctedPlacement = Math.min(
            labelsWithPlacements[labelsWithPlacements.length - 1]
                .correctedPlacement,
            dualAxis.horizontalAxis.rangeSize
        )
        for (let i = labelsWithPlacements.length - 1; i > 0; i--) {
            const current = labelsWithPlacements[i]
            const previous = labelsWithPlacements[i - 1]
            const maxPreviousX =
                current.correctedPlacement - correctedLabelWidth
            if (previous.correctedPlacement > maxPreviousX)
                previous.correctedPlacement = maxPreviousX
        }

        return labelsWithPlacements
    }

    @computed private get labelLines(): JSX.Element[] {
        const { labelsWithPlacementInfo, dualAxis, selectedItems } = this
        const shiftedGroups: LabelWithPlacement[][] = []
        const unshiftedElements: LabelWithPlacement[] = []
        const selectedItemsKeys = new Set(
            selectedItems.map((item) => item.entityId)
        )
        let startNewGroup = true

        const barEndpointY = dualAxis.verticalAxis.place(0)

        for (const labelWithPlacement of labelsWithPlacementInfo) {
            if (
                labelWithPlacement.preferredPlacement ===
                labelWithPlacement.correctedPlacement
            ) {
                unshiftedElements.push(labelWithPlacement)
                startNewGroup = true
            } else {
                if (startNewGroup) {
                    shiftedGroups.push([labelWithPlacement])
                    startNewGroup = false
                } else {
                    shiftedGroups[shiftedGroups.length - 1].push(
                        labelWithPlacement
                    )
                }
            }
        }
        // If we wanted to hide the label lines if all lines are straight
        // then we could do this but this makes it jumpy over time
        // if (shiftedGroups.length === 0) return []
        // else {
        const labelLines: JSX.Element[] = []
        for (const group of shiftedGroups) {
            let indexInGroup = 0
            for (const item of group) {
                const lineColor = selectedItemsKeys.has(item.labelKey)
                    ? "#999"
                    : "#bbb"
                const markerBarEndpointX = item.preferredPlacement
                const markerTextEndpointX = item.correctedPlacement
                const markerBarEndpointY = barEndpointY + MARKER_MARGIN
                const markerTextEndpointY =
                    barEndpointY + MARKER_AREA_HEIGHT - MARKER_MARGIN
                const markerNetHeight = MARKER_AREA_HEIGHT - 2 * MARKER_MARGIN
                const markerStepSize = markerNetHeight / (group.length + 1)
                const directionUnawareMakerYMid =
                    (indexInGroup + 1) * markerStepSize
                const markerYMid =
                    markerBarEndpointX > markerTextEndpointX
                        ? directionUnawareMakerYMid
                        : markerNetHeight - directionUnawareMakerYMid
                labelLines.push(
                    <g className="indicator" key={`labelline-${item.labelKey}`}>
                        <path
                            d={`M${markerBarEndpointX},${markerBarEndpointY} v${markerYMid} H${markerTextEndpointX} V${markerTextEndpointY}`}
                            stroke={lineColor}
                            strokeWidth={1}
                            fill="none"
                        />
                    </g>
                )
                indexInGroup++
            }
        }
        for (const item of unshiftedElements) {
            const lineColor = selectedItemsKeys.has(item.labelKey)
                ? "#999"
                : "#bbb"
            const markerBarEndpointX = item.preferredPlacement
            const markerBarEndpointY = barEndpointY + MARKER_MARGIN
            const markerTextEndpointY =
                barEndpointY + MARKER_AREA_HEIGHT - MARKER_MARGIN

            labelLines.push(
                <g className="indicator" key={`labelline-${item.labelKey}`}>
                    <path
                        d={`M${markerBarEndpointX},${markerBarEndpointY} V${markerTextEndpointY}`}
                        stroke={lineColor}
                        strokeWidth={1}
                        fill="none"
                    />
                </g>
            )
        }
        return labelLines
        //}
    }

    @computed private get placedLabels(): JSX.Element[] {
        const labelOffset = MARKER_AREA_HEIGHT
        // old logic tried to hide labellines but that is too jumpy
        // labelLines.length
        //     ? MARKER_AREA_HEIGHT
        //     : this.baseFontSize / 2
        const placedLabels = this.labelsWithPlacementInfo.map((item) => (
            <g
                key={`label-${item.labelKey}`}
                className="bar-label"
                transform={`translate(${item.correctedPlacement}, ${labelOffset})`}
                onMouseOver={(): void => this.onEntityMouseOver(item.labelKey)}
                onMouseLeave={(): void => this.onEntityMouseLeave()}
                onClick={(): void => this.onEntityClick(item.labelKey)}
            >
                {item.label}
            </g>
        ))

        return placedLabels
    }

    @computed private get unrotatedLongestLabelWidth(): number {
        const widths = this.pickedLabelCandidates.map(
            (candidate) => candidate.bounds.width
        )
        const maxWidth = Math.max(...widths)
        return maxWidth
    }

    @computed private get unrotatedHighestLabelHeight(): number {
        const heights = this.pickedLabelCandidates.map(
            (candidate) => candidate.bounds.height
        )
        return Math.max(...heights)
    }

    @computed private get longestLabelHeight(): number {
        // This takes the angle of rotation of the entity labels into account
        // This is somewhat simplified as we treat this as a one-dimensional
        // entity whereas in reality the textbox if of course 2D. To account
        // for that we do max(fontSize, rotatedLabelHeight) in the end
        // as a rough proxy
        const rotatedLabelHeight =
            this.unrotatedLongestLabelWidth *
            Math.abs(Math.sin((this.labelAngleInDegrees * Math.PI) / 180))
        return Math.max(this.fontSize, rotatedLabelHeight)
    }

    @computed private get longestLabelWidth(): number {
        // This takes the angle of rotation of the entity labels into account
        // This is somewhat simplified as we treat this as a one-dimensional
        // entity whereas in reality the textbox if of course 2D. To account
        // for that we do max(fontSize, rotatedLabelHeight) in the end
        // as a rough proxy
        const rotatedLabelWidth =
            this.unrotatedLongestLabelWidth *
            Math.abs(Math.cos((this.labelAngleInDegrees * Math.PI) / 180))
        return Math.max(this.fontSize, rotatedLabelWidth)
    }

    @computed private get labels(): LabelCandidateWithElement[] {
        const { labelAngleInDegrees } = this
        return this.pickedLabelCandidates.map((candidate) => {
            const labelX = candidate.bounds.width
            return {
                candidate,
                labelElement: (
                    <text
                        key={`${candidate.item.entityId}-label`}
                        x={-labelX}
                        y={0}
                        width={candidate.bounds.width}
                        height={candidate.bounds.height}
                        fontWeight={candidate.isSelected ? 700 : 300}
                        fill="#000"
                        transform={`rotate(${labelAngleInDegrees}, 0, 0)`}
                        opacity={1}
                        fontSize="0.7em"
                        textAnchor="right"
                        dominantBaseline="middle"
                        onMouseOver={(): void =>
                            this.onEntityMouseOver(candidate.item.entityId)
                        }
                        onMouseLeave={(): void => this.onEntityMouseLeave()}
                        onClick={(): void =>
                            this.onEntityClick(candidate.item.entityId)
                        }
                    >
                        {candidate.item.entityId}
                    </text>
                ),
            }
        })
    }

    private static Tooltip(props: TooltipProps): JSX.Element {
        let hasTimeNotice = false
        const isSingleVariable = props.item.bars.length === 1
        const header = isSingleVariable ? (
            <tr>
                <td>
                    <div
                        style={{
                            width: "10px",
                            height: "10px",
                            backgroundColor: props.item.entityColor?.color,
                            display: "inline-block",
                        }}
                    />
                </td>
                <td colSpan={3} style={{ color: "#111" }}>
                    <strong>{props.item.entityId}</strong>
                </td>
            </tr>
        ) : (
            <tr>
                <td colSpan={4} style={{ color: "#111" }}>
                    <strong>{props.item.entityId}</strong>
                </td>
            </tr>
        )

        return (
            <table
                style={{
                    lineHeight: "1em",
                    whiteSpace: "normal",
                    borderSpacing: "0.5em",
                }}
            >
                <tbody>
                    {header}
                    {props.item.bars.map((bar) => {
                        const { highlightedSeriesName } = props
                        const squareColor = bar.color
                        const isHighlighted =
                            bar.seriesName === highlightedSeriesName
                        const isFaint =
                            highlightedSeriesName !== undefined &&
                            !isHighlighted
                        const shouldShowTimeNotice =
                            bar.yPoint.value !== undefined &&
                            bar.yPoint.time !== props.targetTime
                        hasTimeNotice ||= shouldShowTimeNotice
                        const colorSquare = isSingleVariable ? null : (
                            <div
                                style={{
                                    width: "10px",
                                    height: "10px",
                                    backgroundColor: squareColor,
                                    display: "inline-block",
                                }}
                            />
                        )

                        return (
                            <tr
                                key={`${bar.seriesName}`}
                                style={{
                                    color: isHighlighted
                                        ? "#000"
                                        : isFaint
                                        ? "#707070"
                                        : "#444",
                                }}
                            >
                                <td>{colorSquare}</td>
                                <td
                                    style={{
                                        paddingRight: "0.8em",
                                        fontSize: "0.9em",
                                    }}
                                >
                                    {bar.seriesName}
                                </td>
                                <td
                                    style={{
                                        textAlign: "right",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {bar.yPoint.value === undefined
                                        ? "No data"
                                        : props.formatColumn.formatValueShort(
                                              bar.yPoint.value,
                                              {
                                                  noTrailingZeroes: false,
                                              }
                                          )}
                                </td>
                                {shouldShowTimeNotice && (
                                    <td
                                        style={{
                                            fontWeight: "normal",
                                            color: "#707070",
                                            fontSize: "0.8em",
                                            whiteSpace: "nowrap",
                                            paddingLeft: "8px",
                                        }}
                                    >
                                        <span className="icon">
                                            <FontAwesomeIcon
                                                icon={faInfoCircle}
                                                style={{
                                                    marginRight: "0.25em",
                                                }}
                                            />{" "}
                                        </span>
                                        {props.timeColumn.formatValue(
                                            props.item.xPoint.time
                                        )}
                                    </td>
                                )}
                            </tr>
                        )
                    })}
                    <tr>
                        <td></td>
                        <td>{props.xAxisColumn.displayName}</td>
                        <td
                            style={{
                                textAlign: "right",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {props.xAxisColumn.formatValueShort(
                                props.item.xPoint.value
                            )}
                        </td>
                        <td></td>
                    </tr>
                    {hasTimeNotice && (
                        <tr>
                            <td
                                colSpan={4}
                                style={{
                                    color: "#707070",
                                    fontSize: "0.8em",
                                    paddingTop: "10px",
                                }}
                            >
                                <div style={{ display: "flex" }}>
                                    <span
                                        className="icon"
                                        style={{ marginRight: "0.5em" }}
                                    >
                                        <FontAwesomeIcon icon={faInfoCircle} />{" "}
                                    </span>
                                    <span>
                                        No data available for{" "}
                                        {props.timeColumn.formatValue(
                                            props.targetTime
                                        )}
                                        . Showing closest available data point
                                        instead.
                                    </span>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        )
    }

    @computed get failMessage(): string {
        const column = this.yColumns[0]
        const { yColumns, yColumnSlugs, xColumn } = this

        if (!column) return "No Y column to chart"
        if (!xColumn) return "No X column to chart"

        return yColumns.every((col) => col.isEmpty)
            ? `No matching data in columns ${yColumnSlugs.join(", ")}`
            : ""
    }

    @computed protected get yColumnSlugs(): string[] {
        return (
            this.manager.yColumnSlugsInSelectionOrder ??
            autoDetectYColumnSlugs(this.manager)
        )
    }

    @computed protected get xColumnSlug(): string | undefined {
        return this.manager.xColumnSlug
    }

    @computed protected get xColumn(): CoreColumn {
        const columnSlugs = this.xColumnSlug ? [this.xColumnSlug] : []
        if (!columnSlugs.length) console.warn("No x column slug!")
        return this.transformedTable.getColumns(columnSlugs)[0]
    }

    @computed protected get xColumnFullTimeRange(): CoreColumn {
        const columnSlugs = this.xColumnSlug ? [this.xColumnSlug] : []
        if (!columnSlugs.length) console.warn("No x column slug!")
        return this.inputTable.getColumns(columnSlugs)[0]
    }

    @computed protected get yColumns(): CoreColumn[] {
        return this.transformedTable.getColumns(this.yColumnSlugs)
    }

    @computed private get colorScheme(): ColorScheme {
        return (
            (this.manager.baseColorScheme
                ? ColorSchemes[this.manager.baseColorScheme]
                : undefined) ?? ColorSchemes["owid-distinct"]
        )
    }

    @computed private get colorColumnSlug(): string | undefined {
        return this.manager.colorColumnSlug
    }

    @computed private get colorColumn(): CoreColumn {
        return this.transformedTable.get(this.colorColumnSlug)
    }

    colorScale = new ColorScale(this)
    @computed get colorScaleConfig(): ColorScaleConfigDefaults | undefined {
        return (
            ColorScaleConfig.fromDSL(this.colorColumn.def) ??
            this.manager.colorScale
        )
    }

    @computed get colorScaleColumn(): CoreColumn {
        // We need to use inputTable in order to get consistent coloring for a variable across
        // charts, e.g. each continent being assigned to the same color.
        // inputTable is unfiltered, so it contains every value that exists in the variable.
        return this.inputTable.get(this.colorColumnSlug)
    }

    @computed private get unstackedSeries(): StackedSeries<EntityName>[] {
        const { colorScheme, yColumns } = this
        return (
            yColumns
                .map((col, i) => {
                    return {
                        seriesName: col.displayName,
                        columnSlug: col.slug,
                        color:
                            col.def.color ??
                            colorScheme.getColors(yColumns.length)[i],
                        points: col.owidRows.map((row) => ({
                            time: row.time,
                            position: row.entityName,
                            value: row.value,
                            valueOffset: 0,
                        })),
                    }
                })
                // Do not plot columns without data
                .filter((series) => series.points.length > 0)
        )
    }

    @computed get series(): readonly StackedSeries<EntityName>[] {
        return stackSeries(this.unstackedSeries)
    }

    @computed get xSeries(): SimpleChartSeries {
        const createStackedXPoints = (
            rows: LegacyOwidRow<any>[]
        ): SimplePoint[] => {
            const points: SimplePoint[] = []
            console.log("x Points count", points.length)
            for (const row of rows) {
                points.push({
                    time: row.time,
                    value: row.value,
                    entity: row.entityName,
                })
            }
            return points
        }
        const column = this.xColumn
        return {
            seriesName: column.displayName,
            points: createStackedXPoints(column.owidRows),
        }
    }
}
