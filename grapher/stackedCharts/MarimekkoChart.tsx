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

interface Bar {
    color: Color // color from the variable
    seriesName: string
    yPoint: StackedPoint<EntityName>
}

interface Item {
    label: string
    entityColor: EntityColorData | undefined
    bars: Bar[] // contains the y values for every y variable
    xPoint: SimplePoint // contains the single x value
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
    label: string
    xValue: number
}
interface LabelCandidate {
    item: EntityWithSize
    bounds: Bounds
    isPicked: boolean
    isSelected: boolean
}

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
        table = table.dropRowsWithErrorValuesForAllColumns(yColumnSlugs)
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
        const labels = this.items.map((item) => item.label)
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

    @computed private get xDomainCorrectionFactor(): number {
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

        const points = this.xSeries.points
            .map((point) => point.value)
            .sort((a, b) => a - b)
        const total = sum(points)
        const widthInPixels = this.xRange[1] - this.xRange[0]
        let onePixelDomainValueEquivalent = total / widthInPixels
        let numCountriesBelowOnePixel = 0
        let sumToRemoveFromTotal = 0
        for (let i = 0; i < points.length; i++) {
            if (points[i] >= onePixelDomainValueEquivalent) break
            numCountriesBelowOnePixel++
            sumToRemoveFromTotal += points[i]
            onePixelDomainValueEquivalent =
                total / (widthInPixels - numCountriesBelowOnePixel)
        }
        return (
            (total -
                numCountriesBelowOnePixel * onePixelDomainValueEquivalent) /
            (total - sumToRemoveFromTotal)
        )
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
        const { items } = this
        if (selectedSet.size === 0) return []
        return items.filter((item) => selectedSet.has(item.label))
    }

    @computed private get items(): Item[] {
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
                    label: entityName,
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
                                yPoint: point,
                                color: series.color,
                                seriesName: series.seriesName,
                            }
                        })
                    ),
                }
            })
            .filter((item) => item?.bars.length) as Item[]

        return sortBy(items, (item) => {
            const lastPoint = last(item.bars)?.yPoint
            if (!lastPoint) return 0
            return lastPoint.valueOffset + lastPoint.value
        }).reverse()
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
            labels,
            manager,
        } = this
        let currentX = Math.round(dualAxis.horizontalAxis.place(this.x0))
        const selectionSet = this.selectionArray.selectedSet
        let isEven = true
        const targetTime = this.manager.endTime
        const timeColumn = this.inputTable.timeColumn
        const formatColumn = this.formatColumn
        const xAxisColumn = this.xColumn

        const labelsWithPlacements: {
            label: JSX.Element
            preferredPlacement: number
            correctedPlacement: number
            labelKey: string
        }[] = []

        for (const item of this.items) {
            const { label, bars, xPoint, entityColor } = item
            const tooltipProps = {
                item,
                targetTime,
                timeColumn,
                formatColumn,
                xAxisColumn,
            }
            const optionalLabel = labels.get(label)

            const exactWidth =
                dualAxis.horizontalAxis.place(xPoint.value) -
                dualAxis.horizontalAxis.place(x0)
            const correctedWidth = exactWidth * xDomainCorrectionFactor
            const barWidth = correctedWidth > 1 ? Math.round(correctedWidth) : 1
            const labelsYPosition =
                dualAxis.verticalAxis.place(0) + this.baseFontSize / 2
            if (optionalLabel) {
                labelsWithPlacements.push({
                    label: (
                        <g
                            transform={`translate(${
                                barWidth / 2
                            }, ${labelsYPosition})`}
                        >
                            <TippyIfInteractive
                                lazy
                                isInteractive={!manager.isExportingtoSvgOrPng}
                                key={label}
                                hideOnClick={false}
                                content={
                                    <MarimekkoChart.Tooltip {...tooltipProps} />
                                }
                            >
                                {optionalLabel}
                            </TippyIfInteractive>
                        </g>
                    ),
                    preferredPlacement: currentX,
                    correctedPlacement: currentX,
                    labelKey: label,
                })
            }
            const isSelected = selectionSet.has(label)
            const isHovered = label === this.hoveredEntityName
            const result = (
                <g
                    key={label}
                    className="bar"
                    transform={`translate(${currentX}, 0)`}
                    onMouseOver={(): void => this.onEntityMouseOver(label)}
                    onMouseLeave={(): void => this.onEntityMouseLeave()}
                    onClick={(): void => this.onEntityClick(label)}
                >
                    {bars.map((bar) => {
                        const isFaint =
                            focusSeriesName !== undefined &&
                            entityColor?.colorDomainValue !== focusSeriesName

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
                    })}
                </g>
            )
            if (isSelected || isHovered) highlightedElements.push(result)
            else normalElements.push(result)
            currentX += barWidth
            isEven = !isEven
        }

        const placedLabels = labelsWithPlacements.map((item) => (
            <g
                key={`label-${item.labelKey}`}
                className="bar-label"
                transform={`translate(${item.preferredPlacement}, 0)`}
                onMouseOver={(): void => this.onEntityMouseOver(item.labelKey)}
                onMouseLeave={(): void => this.onEntityMouseLeave()}
                onClick={(): void => this.onEntityClick(item.labelKey)}
            >
                {item.label}
            </g>
        ))

        return normalElements.concat(placedLabels, highlightedElements)
    }
    private paddingInPixels = 5

    private renderBar(
        bar: Bar,
        tooltipProps: TooltipProps,
        barWidth: number,
        isHovered: boolean,
        isSelected: boolean,
        isFaint: boolean,
        entityColor: string | undefined
    ): JSX.Element {
        const { dualAxis, manager } = this
        const { yPoint, seriesName } = bar

        const barBaseColor = entityColor ?? bar.color

        const barColor = isHovered
            ? color(barBaseColor)?.brighter(0.9).toString() ?? barBaseColor
            : isSelected
            ? color(barBaseColor)?.brighter(0.6).toString() ?? barBaseColor
            : barBaseColor
        const strokeColor = isHovered || isSelected ? "#555" : "#666"
        const strokeWidth = isHovered || isSelected ? "1px" : "0.3px"

        const barY = dualAxis.verticalAxis.place(this.y0 + yPoint.valueOffset)
        const barHeight =
            dualAxis.verticalAxis.place(this.y0) -
            dualAxis.verticalAxis.place(yPoint.value)
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
            bounds: Bounds.forText(item.label, {
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
            selectedItems.map((item) => item.label)
        )

        const labelCandidates: LabelCandidate[] = [
            ...lastYearOfEachEntity.entries(),
        ].map(([entity, row]) =>
            MarimekkoChart.labelCanidateFromItem(
                { label: entity, xValue: row.value },
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
        for (const max of picks) {
            if (max) max.isPicked = true
        }
        const picked = labelCandidates.filter((candidate) => candidate.isPicked)

        return picked
    }

    @computed private get unrotatedLongestLabelWidth(): number {
        const widths = this.pickedLabelCandidates.map(
            (candidate) => candidate.bounds.width
        )
        const maxWidth = Math.max(...widths)
        return maxWidth
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

    @computed private get labels(): Map<EntityName, JSX.Element> {
        const { labelAngleInDegrees } = this
        const labelMap: Map<EntityName, JSX.Element> = new Map()
        for (const candidate of this.pickedLabelCandidates) {
            const labelX = candidate.bounds.width
            labelMap.set(
                candidate.item.label,
                <text
                    key={`${candidate.item.label}-label`}
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
                        this.onEntityMouseOver(candidate.item.label)
                    }
                    onMouseLeave={(): void => this.onEntityMouseLeave()}
                    onClick={(): void =>
                        this.onEntityClick(candidate.item.label)
                    }
                >
                    {candidate.item.label}
                </text>
            )
        }

        return labelMap
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
                    <strong>{props.item.label}</strong>
                </td>
            </tr>
        ) : (
            <tr>
                <td colSpan={4} style={{ color: "#111" }}>
                    <strong>{props.item.label}</strong>
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
