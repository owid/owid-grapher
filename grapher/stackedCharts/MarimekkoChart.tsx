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
    partition,
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

import {
    HorizontalAlign,
    Position,
    SortBy,
    SortConfig,
    SortOrder,
} from "../../clientUtils/owidTypes"
import { StackedPoint, StackedSeries } from "./StackedConstants"
import { ColorSchemes } from "../color/ColorSchemes"
import {
    EntityName,
    LegacyOwidRow,
    OwidTableSlugs,
} from "../../coreTable/OwidTableConstants"
import {
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
import {
    MarimekkoChartManager,
    EntityColorData,
    SimplePoint,
    SimpleChartSeries,
    BarShape,
    Bar,
    Item,
    PlacedItem,
    TooltipProps,
    EntityWithSize,
    LabelCandidate,
    LabelWithPlacement,
    LabelCandidateWithElement,
    MarimekkoBarProps,
} from "./MarimekkoChartConstants"

const MARKER_MARGIN: number = 4
const MARKER_AREA_HEIGHT: number = 25

function MarimekkoBar({
    bar,
    tooltipProps,
    barWidth,
    isHovered,
    isSelected,
    isFaint,
    entityColor,
    y0,
    isInteractive,
    dualAxis,
}: MarimekkoBarProps): JSX.Element {
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
    const strokeColor = barColor
    const strokeWidth = isHovered || isSelected ? "1px" : "0.5px"
    const strokeOpacity = isPlaceholder ? 0.8 : isFaint ? 0.2 : 1.0
    const fillOpacity = isHovered
        ? 0.7
        : isFaint
        ? 0.2
        : isSelected
        ? isPlaceholder
            ? 0.3
            : 0.7
        : 0.7
    const overalOpacity = isPlaceholder ? 0.2 : 1.0

    let barY: number = 0
    let barHeight: number = 0
    if (bar.kind === BarShape.Bar) {
        barY = dualAxis.verticalAxis.place(y0 + bar.yPoint.valueOffset)
        barHeight =
            dualAxis.verticalAxis.place(y0) -
            dualAxis.verticalAxis.place(bar.yPoint.value)
    } else {
        barY = dualAxis.verticalAxis.place(y0)
        barHeight = bar.height
    }
    const barX = 0

    const renderedBar = (
        <g key={seriesName}>
            <rect
                x={0}
                y={0}
                transform={`translate(${barX}, ${barY - barHeight})`}
                width={barWidth}
                height={barHeight}
                fill={barColor}
                fillOpacity={fillOpacity}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                opacity={overalOpacity}
                style={{
                    transition: "translate 200ms ease",
                }}
            />
        </g>
    )
    if (tooltipProps) {
        return (
            <TippyIfInteractive
                lazy
                isInteractive={isInteractive}
                key={seriesName}
                animation={false}
                visible={isHovered}
                content={<MarimekkoChart.Tooltip {...tooltipProps} />}
            >
                {renderedBar}
            </TippyIfInteractive>
        )
    } else return renderedBar
}

interface MarimekkoBarsProps {
    entityName: string
    bars: Bar[]
    entityColor: EntityColorData | undefined
    isFaint: boolean
    isHovered: boolean
    isSelected: boolean
    barWidth: number
    tooltipProps: TooltipProps
    currentX: number
    onEntityMouseOver: (entityName: string) => void
    onEntityMouseLeave: () => void
    onEntityClick: (entityName: string) => void
    labelYOffset: number
    y0: number
    noDataHeight: number
    dualAxis: DualAxis
    isExportingToSvgOrPng: boolean | undefined
}

function MarimekkoBarsForOneEntity(props: MarimekkoBarsProps): JSX.Element {
    7
    const {
        entityName,
        bars,
        entityColor,
        isFaint,
        isHovered,
        isSelected,
        barWidth,
        tooltipProps,
        currentX,
        onEntityClick,
        onEntityMouseLeave,
        onEntityMouseOver,
        labelYOffset,
        y0,
        noDataHeight,
        dualAxis,
        isExportingToSvgOrPng,
    } = props

    let content = undefined
    if (bars.length) {
        const allButLast = bars.slice(0, -1)
        const last = bars[bars.length - 1]
        // This is annoying - I tried to use the tippy element around all bars instead of inside
        // one single bar but then it renders at the document origin instead of at the right attach point
        // since we will switch to another tooltip solution anyhow I would leave it at this for now -
        // later on this splitting into allbutlast and last can be removed and tooltips just done elsewhere
        const allButLastElements = allButLast.map((bar) => (
            <MarimekkoBar
                key={`${entityName}-${bar.seriesName}`}
                bar={bar}
                tooltipProps={undefined}
                barWidth={barWidth}
                isHovered={isHovered}
                isSelected={isSelected}
                isFaint={isFaint}
                entityColor={entityColor?.color}
                y0={y0}
                isInteractive={!isExportingToSvgOrPng}
                dualAxis={dualAxis}
            />
        ))
        const lastElement = (
            <MarimekkoBar
                key={`${entityName}-${last.seriesName}`}
                bar={last}
                tooltipProps={{
                    ...tooltipProps,
                    highlightedSeriesName: last.seriesName,
                }}
                barWidth={barWidth}
                isHovered={isHovered}
                isSelected={isSelected}
                isFaint={isFaint}
                entityColor={entityColor?.color}
                y0={y0}
                isInteractive={!isExportingToSvgOrPng}
                dualAxis={dualAxis}
            />
        )

        content = allButLastElements
        content.push(lastElement)
    } else {
        content = (
            <MarimekkoBar
                key={`${entityName}-placeholder`}
                tooltipProps={tooltipProps}
                bar={{
                    kind: BarShape.BarPlaceholder,
                    seriesName: entityName,
                    height: noDataHeight,
                }}
                barWidth={barWidth}
                isHovered={isHovered}
                isSelected={isSelected}
                isFaint={isFaint}
                entityColor={entityColor?.color}
                y0={y0}
                isInteractive={!isExportingToSvgOrPng}
                dualAxis={dualAxis}
            />
        )
    }

    return (
        <g
            key={entityName}
            className="bar"
            transform={`translate(${currentX}, ${labelYOffset})`}
            onMouseOver={(): void => onEntityMouseOver(entityName)}
            onMouseLeave={(): void => onEntityMouseLeave()}
            onClick={(): void => onEntityClick(entityName)}
        >
            {content}
        </g>
    )
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
        table = table.replaceNonNumericCellsWithErrorValues(yColumnSlugs)

        yColumnSlugs.forEach((slug) => {
            table = table.interpolateColumnWithTolerance(slug)
        })

        table = table.interpolateColumnWithTolerance(xColumnSlug)

        if (colorColumnSlug) {
            const tolerance =
                table.get(colorColumnSlug)?.display?.tolerance ?? Infinity
            table = table.interpolateColumnWithTolerance(
                colorColumnSlug,
                tolerance
            )
            if (manager.matchingEntitiesOnly) {
                table = table.dropRowsWithErrorValuesForColumn(colorColumnSlug)
            }
        }
        if (!manager.showNoDataArea)
            table = table.dropRowsWithErrorValuesForAllColumns(yColumnSlugs)

        table = table.dropRowsWithErrorValuesForAnyColumn([xColumnSlug])
        if (manager.isRelativeMode) {
            table = table.toPercentageFromEachEntityForEachTime(xColumnSlug)
        }

        return table
    }

    @observable private hoveredEntityName?: string

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

    //@computed private get rows(): readonly

    @computed get series(): readonly StackedSeries<EntityName>[] {
        const valueOffsets = new Map<string, number>()
        return this.unstackedSeries.map((series) => ({
            ...series,
            points: series.points.map((point) => {
                const offset = valueOffsets.get(point.position) ?? 0
                const newPoint = { ...point, valueOffset: offset }
                valueOffsets.set(point.position, offset + point.value)
                return newPoint
            }),
        }))
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

    @computed private get latestTime(): number | undefined {
        const times = this.manager.tableAfterAuthorTimelineAndActiveChartTransformAndPopulationFilter?.getTimesUniqSortedAscForColumns(
            this.yColumnSlugs
        )

        return times ? last(times) : undefined
    }
    @computed private get tableAtLatestTimelineTimepoint():
        | OwidTable
        | undefined {
        if (this.latestTime)
            return this.manager.tableAfterAuthorTimelineAndActiveChartTransformAndPopulationFilter?.filterByTargetTimes(
                [this.latestTime],
                0
            )
        else return undefined
    }
    @computed protected get xColumnAtLastTimePoint(): CoreColumn | undefined {
        const columnSlug = this.xColumnSlug ? [this.xColumnSlug] : []
        if (this.tableAtLatestTimelineTimepoint)
            return this.tableAtLatestTimelineTimepoint.getColumns(columnSlug)[0]
        else return undefined
    }

    @computed protected get yColumnsAtLastTimePoint(): CoreColumn[] {
        const columnSlugs = this.yColumnSlugs
        return (
            this.tableAtLatestTimelineTimepoint?.getColumns(columnSlugs) ?? []
        )
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
    @computed private get sortConfig(): SortConfig {
        return this.manager.sortConfig ?? {}
    }

    @computed private get manager(): MarimekkoChartManager {
        return this.props.manager
    }

    @computed private get bounds(): Bounds {
        return (this.props.bounds ?? DEFAULT_BOUNDS).padRight(10)
    }

    @computed private get innerBounds(): Bounds {
        // This is a workaround to get the actual width of the vertical axis - dualAxis does this
        // internally but we can't access this.dualAxis here due to a dependency cycle
        const axis = this.verticalAxisPart.clone()
        axis.range = [0, this.bounds.height]
        const verticalAxisTrueWidth = axis.width

        const whiteSpaceOnLeft = this.bounds.left + verticalAxisTrueWidth
        const labelLinesHeight = MARKER_AREA_HEIGHT
        // only pad left by the amount the longest label would exceed whatever space the
        // vertical axis needs anyhow for label and tickmarks
        const marginToEnsureWidestEntityLabelFitsEvenIfAtX0 =
            Math.max(whiteSpaceOnLeft, this.longestLabelWidth) -
            whiteSpaceOnLeft
        return this.bounds
            .padBottom(this.longestLabelHeight)
            .padBottom(labelLinesHeight)
            .padTop(this.legend.height + this.legendPaddingTop)
            .padLeft(marginToEnsureWidestEntityLabelFitsEvenIfAtX0)
    }

    @computed private get baseFontSize(): number {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
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

    /** This flag determines if we ensure that every entity is at least
        one pixel wide. If it is set then
        every entity is drawn at least one px wide (e.g. the Vatican in a list of
        countries). If this happens then the xDomainCorrectionFactor is caluclated
        to compensate for this artificial enlarging of small entities.

        In late September 2021 I am removing this mechanism as I think it leads
        to more confusion than it's worth
    */
    @computed private get mustEnsureOnePixelXSize(): boolean {
        return false
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

        const { xSeries, dualAxis } = this

        if (!this.mustEnsureOnePixelXSize) return 1

        if (!xSeries.points.length) return 1

        const points = xSeries.points
            .map((point) => point.value)
            .sort((a, b) => a - b)
        const total = sum(points)
        const widthInPixels = dualAxis.horizontalAxis.rangeSize
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
        return xDomainCorrectionFactor
    }

    @computed private get xDomainDefault(): [number, number] {
        const sum = sumBy(this.xSeries.points, (point) => point.value)

        return [this.x0, sum]
    }

    @computed private get xRange(): [number, number] {
        return [this.bounds.left, this.bounds.right]
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    @computed private get xAxisConfig(): AxisConfig {
        return new AxisConfig(
            { ...this.manager.xAxisConfig, orient: Position.top },
            this
        )
    }
    @computed private get verticalAxisPart(): VerticalAxis {
        const config = this.yAxisConfig
        const axis = config.toVerticalAxis()
        axis.updateDomainPreservingUserSettings(this.yDomainDefault)

        axis.formatColumn = this.yColumns[0]
        const fallbackLabel =
            this.yColumns.length > 0 ? this.yColumns[0].displayName : ""
        axis.label = this.isNarrow ? "" : config.label || fallbackLabel

        return axis
    }
    @computed private get isNarrow(): boolean {
        // TODO: this should probably come from grapher?
        return this.bounds.width < 650 // innerBounds would lead to dependency cycle
    }
    @computed private get xAxisLabelBase(): string {
        const xDimName = this.xColumn?.displayName
        if (this.manager.xOverrideTime !== undefined)
            return `${xDimName} in ${this.manager.xOverrideTime}`
        return xDimName
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        const { manager, xAxisLabelBase, xDomainDefault, xColumn } = this
        const config = this.xAxisConfig
        const axis = config.toHorizontalAxis()
        if (manager.isRelativeMode) axis.domain = [0, 100]
        else axis.updateDomainPreservingUserSettings(xDomainDefault)

        axis.formatColumn = xColumn

        const label = config.label || xAxisLabelBase
        axis.label = label
        return axis
    }

    @computed private get dualAxis(): DualAxis {
        return new DualAxis({
            bounds: this.innerBounds,
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
        return sortedItems.filter((item) => selectedSet.has(item.entityName))
    }

    @computed private get domainColorForEntityMap(): Map<
        string,
        EntityColorData
    > {
        const { colorColumn, colorScale } = this
        const entityNames = this.xColumn.uniqEntityNames
        const hasColorColumn = !colorColumn.isMissing
        const colorRowsByEntity = hasColorColumn
            ? colorColumn.owidRowsByEntityName
            : undefined
        const domainColorMap = new Map<string, EntityColorData>()
        for (const name of entityNames) {
            const colorDomainValue = colorRowsByEntity?.get(name)?.[0]

            if (colorDomainValue) {
                const color = colorScale.getColor(colorDomainValue.value)
                if (color)
                    domainColorMap.set(name, {
                        color,
                        colorDomainValue: colorDomainValue.value,
                    })
            }
        }
        return domainColorMap
    }

    @computed private get items(): Item[] {
        const entityNames = this.xColumn.uniqEntityNames
        const { xSeries, series, domainColorForEntityMap } = this

        const items: Item[] = entityNames
            .map((entityName) => {
                const xPoint = xSeries.points.find(
                    (point) => point.entity === entityName
                )
                if (!xPoint) return undefined

                const color = domainColorForEntityMap.get(entityName)

                return {
                    entityName,
                    xPoint: xPoint,
                    entityColor: color,
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

        return items
    }

    @computed private get sortedItems(): Item[] {
        const { items, sortConfig } = this

        let sortByFunc: (item: Item) => number | string
        switch (sortConfig.sortBy) {
            case SortBy.entityName:
                sortByFunc = (item: Item): string => item.entityName
                break
            case SortBy.column:
                const sortColumnSlug = sortConfig.sortColumnSlug
                sortByFunc = (item: Item): number =>
                    item.bars.find((b) => b.seriesName === sortColumnSlug)
                        ?.yPoint.value ?? 0
                break
            default:
            case SortBy.total:
                sortByFunc = (item: Item): number => {
                    const lastPoint = last(item.bars)?.yPoint
                    if (!lastPoint) return 0
                    return lastPoint.valueOffset + lastPoint.value
                }
        }
        const sortedItems = sortBy(items, sortByFunc)
        const sortOrder = sortConfig.sortOrder ?? SortOrder.desc
        if (sortOrder === SortOrder.desc) sortedItems.reverse()

        const [itemsWithValues, itemsWithoutValues] = partition(
            sortedItems,
            (item) => item.bars.length !== 0
        )

        return [...itemsWithValues, ...itemsWithoutValues]
    }

    @computed get placedItems(): PlacedItem[] {
        const {
            sortedItems,
            dualAxis,
            x0,
            xDomainCorrectionFactor,
            mustEnsureOnePixelXSize,
        } = this
        const placedItems: PlacedItem[] = []
        let currentX = 0
        for (const item of sortedItems) {
            placedItems.push({ ...item, xPosition: currentX })
            const preciseX =
                dualAxis.horizontalAxis.place(
                    item.xPoint.value * xDomainCorrectionFactor
                ) - dualAxis.horizontalAxis.place(x0)
            currentX += mustEnsureOnePixelXSize
                ? Math.max(1, preciseX)
                : preciseX
        }
        return placedItems
    }

    @computed get placedItemsMap(): Map<string, PlacedItem> {
        return new Map(this.placedItems.map((item) => [item.entityName, item]))
    }

    // legend props

    @computed get legendPaddingTop(): number {
        return this.baseFontSize
    }

    @computed get legendX(): number {
        return this.bounds.x
    }

    @computed get categoryLegendY(): number {
        return this.bounds.top
    }

    @computed get legendWidth(): number {
        return this.bounds.width
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.left
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
                <DualAxisComponent dualAxis={dualAxis} showTickMarks={true} />
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
            y0,
            xDomainCorrectionFactor,
            focusSeriesName,
            placedLabels,
            labelLines,
            placedItems,
            hoveredEntityName,
            mustEnsureOnePixelXSize,
        } = this
        const selectionSet = this.selectionArray.selectedSet
        const targetTime = this.manager.endTime
        const timeColumn = this.inputTable.timeColumn
        const yAxisColumn = this.formatColumn
        const xAxisColumn = this.xColumn
        const labelYOffset = 0
        const hasSelection = selectionSet.size > 0
        let noDataAreaElement = undefined
        let noDataLabel = undefined
        let patterns: JSX.Element[] = []
        const noDataHeight = Bounds.forText("no data").height + 10 //  dualAxis.verticalAxis.rangeSize

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
            const lastItem = last(placedItems)!
            const noDataRangeStartX =
                firstNanValueItem.xPosition + dualAxis.horizontalAxis.place(x0)
            const noDataRangeEndX =
                lastItem?.xPosition +
                dualAxis.horizontalAxis.place(lastItem.xPoint.value)
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
                    fontSize="0.8em"
                    textAnchor="middle"
                    dominantBaseline="middle"
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
                    //transform={`translate(${barX}, ${barY - barHeight})`}
                    width={noDataRangeEndX - noDataRangeStartX}
                    height={noDataHeight}
                    fill={"url(#diagonalHatch)"}
                    // stroke={strokeColor}
                    // strokeWidth={strokeWidth}
                    opacity={0.5}
                ></rect>
            )

            patterns = [
                <pattern
                    id="diagonalHatch"
                    key="diagonalHatch"
                    patternUnits="userSpaceOnUse"
                    width="4"
                    height="4"
                    patternTransform="rotate(-45 2 2)"
                >
                    <path d="M -1,2 l 6,0" stroke="#ccc" strokeWidth="1" />
                </pattern>,
            ]
        }

        for (const item of placedItems) {
            const { entityName, bars, xPoint, entityColor } = item
            const currentX = dualAxis.horizontalAxis.place(x0) + item.xPosition
            const tooltipProps = {
                item,
                targetTime,
                timeColumn,
                yAxisColumn,
                xAxisColumn,
            }

            const correctedWidth =
                dualAxis.horizontalAxis.place(
                    xPoint.value * xDomainCorrectionFactor
                ) - dualAxis.horizontalAxis.place(x0)
            const barWidth = mustEnsureOnePixelXSize
                ? correctedWidth > 1
                    ? correctedWidth
                    : 1
                : correctedWidth

            const isSelected = selectionSet.has(entityName)
            const isHovered = entityName === hoveredEntityName
            const isFaint =
                (focusSeriesName !== undefined &&
                    entityColor?.colorDomainValue !== focusSeriesName) ||
                (hasSelection && !isSelected)

            const barsProps = {
                entityName,
                bars,
                xPoint,
                entityColor,
                isFaint,
                isHovered,
                isSelected,
                barWidth,
                tooltipProps,
                currentX,
                onEntityClick: this.onEntityClick,
                onEntityMouseLeave: this.onEntityMouseLeave,
                onEntityMouseOver: this.onEntityMouseOver,
                labelYOffset,
                y0,
                noDataHeight,
                dualAxis,
                isExportingToSvgOrPng: this.manager.isExportingtoSvgOrPng,
            }
            const result = (
                <MarimekkoBarsForOneEntity key={entityName} {...barsProps} />
            )
            if (isSelected || isHovered) highlightedElements.push(result)
            else normalElements.push(result)
        }

        return ([] as JSX.Element[]).concat(
            patterns,
            noDataAreaElement ? [noDataAreaElement] : [],
            normalElements,
            placedLabels,
            labelLines,
            highlightedElements,
            noDataLabel ? [noDataLabel] : []
        )
    }
    private paddingInPixels = 5

    private static labelCandidateFromItem(
        item: EntityWithSize,
        baseFontSize: number,
        isSelected: boolean
    ): LabelCandidate {
        return {
            item: item,
            bounds: Bounds.forText(item.entityName, {
                fontSize: 0.7 * baseFontSize,
            }),
            isPicked: isSelected,
            isSelected,
        }
    }

    /** This function splits label candidates into N groups so that each group has approximately
    the same sum of x value metric. This is useful for picking labels because we want to have e.g.
    20 labels relatively evenly spaced (in x domain space) and this function gives us 20 groups that
    are roughly of equal size and then we can pick the largest of each group */
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
        const {
            xColumnAtLastTimePoint,
            yColumnsAtLastTimePoint,
            selectedItems,
            xRange,
            baseFontSize,
            paddingInPixels,
        } = this

        if (!xColumnAtLastTimePoint || yColumnsAtLastTimePoint.length === 0)
            return []

        // Measure the labels (before any rotation, just normal horizontal labels)
        const selectedItemsSet = new Set(
            selectedItems.map((item) => item.entityName)
        )

        // This is similar to what we would get with .sortedItems but
        // we want this for the last year to pick all labels there - sortedItems
        // changes with the time point the user selects
        const ySizeMap: Map<string, number> = new Map(
            yColumnsAtLastTimePoint[0].owidRows.map((row) => [
                row.entityName,
                row.value,
            ])
        )

        const labelCandidates: LabelCandidate[] = xColumnAtLastTimePoint.owidRows.map(
            (row) =>
                MarimekkoChart.labelCandidateFromItem(
                    {
                        entityName: row.entityName,
                        xValue: row.value,
                        ySortValue: ySizeMap.get(row.entityName),
                    },
                    baseFontSize,
                    selectedItemsSet.has(row.entityName)
                )
        )

        labelCandidates.sort((a, b) => {
            const yRowsForA = a.item.ySortValue
            const yRowsForB = b.item.ySortValue

            if (yRowsForA !== undefined && yRowsForB !== undefined)
                return yRowsForB - yRowsForA
            else if (yRowsForA === undefined && yRowsForB !== undefined)
                return -1
            else if (yRowsForA !== undefined && yRowsForB === undefined)
                return 1
            // (yRowsForA === undefined && yRowsForB === undefined)
            else return 0
        })

        const averageCharacterCount =
            sumBy(labelCandidates, (item) => item.item.entityName.length) /
            labelCandidates.length

        const firstDefined = labelCandidates.find(
            (item) => item.item.ySortValue !== undefined
        )
        const labelCharacterCountThreshold = 1.4 * averageCharacterCount
        // Always pick the first and last element and the first one that is not undefined for y
        // but only if it is less than 1.4 times as long in character count as the average label (avoid
        // picking "Democratic Republic of Congo" for this reason and thus needing lots of space)
        if (
            firstDefined &&
            firstDefined.item.entityName.length < labelCharacterCountThreshold
        )
            firstDefined.isPicked = true
        const labelHeight = labelCandidates[0].bounds.height
        if (
            labelCandidates[labelCandidates.length - 1].item.entityName.length <
            labelCharacterCountThreshold
        )
            labelCandidates[labelCandidates.length - 1].isPicked = true
        const availablePixels = xRange[1] - xRange[0]

        const numLabelsToAdd = Math.floor(
            Math.min(availablePixels / (labelHeight + paddingInPixels) / 4, 20) // factor 4 is arbitrary to taste
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

    @computed private get labelsWithPlacementInfo(): LabelWithPlacement[] {
        const {
            dualAxis,
            x0,
            xDomainCorrectionFactor,
            placedItemsMap,
            labels,
            unrotatedLongestLabelWidth,
            unrotatedHighestLabelHeight,
            labelAngleInDegrees,
            mustEnsureOnePixelXSize,
        } = this
        const labelsYPosition = dualAxis.verticalAxis.place(0)

        const labelsWithPlacements: LabelWithPlacement[] = labels
            .map(({ candidate, labelElement }) => {
                const item = placedItemsMap.get(candidate.item.entityName)
                const xPoint = item?.xPoint.value ?? 0
                const correctedWidth =
                    dualAxis.horizontalAxis.place(
                        xPoint * xDomainCorrectionFactor
                    ) - dualAxis.horizontalAxis.place(x0)
                const barWidth = mustEnsureOnePixelXSize
                    ? correctedWidth > 1
                        ? correctedWidth
                        : 1
                    : correctedWidth
                const labelId = candidate.item.entityName
                if (!item) {
                    console.error(
                        "Could not find item",
                        candidate.item.entityName
                    )
                    return null
                } else {
                    const currentX =
                        dualAxis.horizontalAxis.place(x0) + item.xPosition
                    const labelWithPlacement = {
                        label: (
                            <g
                                transform={`translate(${0}, ${labelsYPosition})`}
                            >
                                {labelElement}
                            </g>
                        ),
                        preferredPlacement: currentX + barWidth / 2,
                        correctedPlacement: currentX + barWidth / 2,
                        labelKey: labelId,
                    }
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
        if (labelsWithPlacements.length === 0) return []

        labelsWithPlacements.sort(
            (a, b) => a.preferredPlacement - b.preferredPlacement
        )

        const labelWidth = unrotatedHighestLabelHeight
        const correctionFactor =
            1 +
            Math.min(
                unrotatedLongestLabelWidth / labelWidth,
                Math.abs(Math.tan(labelAngleInDegrees))
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
            selectedItems.map((item) => item.entityName)
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
                ? "#555"
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
        const { labelAngleInDegrees, series, domainColorForEntityMap } = this
        return this.pickedLabelCandidates.map((candidate) => {
            const labelX = candidate.bounds.width
            const domainColor = domainColorForEntityMap.get(
                candidate.item.entityName
            )
            const seriesColor = series[0].color
            const color = domainColor?.color ?? seriesColor ?? "#000"
            return {
                candidate,
                labelElement: (
                    <text
                        key={`${candidate.item.entityName}-label`}
                        x={-labelX}
                        y={0}
                        width={candidate.bounds.width}
                        height={candidate.bounds.height}
                        fontWeight={candidate.isSelected ? 700 : 400}
                        fill={color}
                        transform={`rotate(${labelAngleInDegrees}, 0, 0)`}
                        opacity={1}
                        fontSize="0.7em"
                        textAnchor="right"
                        dominantBaseline="middle"
                        onMouseOver={(): void =>
                            this.onEntityMouseOver(candidate.item.entityName)
                        }
                        onMouseLeave={(): void => this.onEntityMouseLeave()}
                        onClick={(): void =>
                            this.onEntityClick(candidate.item.entityName)
                        }
                    >
                        {candidate.item.entityName}
                    </text>
                ),
            }
        })
    }

    static Tooltip(props: TooltipProps): JSX.Element {
        const isSingleVariable = props.item.bars.length === 1
        // shouldShowXTimeNoitice is a bit of a lie since at the moment we don't include
        // entities that don't have x values for the current year. This might change though
        // and then the mechanism is already in place
        const shouldShowXTimeNotice =
            props.item.xPoint.time !== props.targetTime
        let hasTimeNotice = shouldShowXTimeNotice
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
                    <strong>{props.item.entityName}</strong>
                </td>
            </tr>
        ) : (
            <tr>
                <td colSpan={4} style={{ color: "#111" }}>
                    <strong>{props.item.entityName}</strong>
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
                        const shouldShowYTimeNotice =
                            bar.yPoint.value !== undefined &&
                            bar.yPoint.time !== props.targetTime

                        hasTimeNotice ||= shouldShowYTimeNotice
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
                                        : props.yAxisColumn.formatValueShort(
                                              bar.yPoint.value,
                                              {
                                                  noTrailingZeroes: false,
                                              }
                                          )}
                                </td>
                                {shouldShowYTimeNotice && (
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
                                            bar.yPoint.time
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
                            {shouldShowXTimeNotice && (
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
}
