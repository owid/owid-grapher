import React from "react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    isEmpty,
    sortBy,
    getRelativeMouse,
    domainExtent,
    minBy,
    exposeInstanceOnWindow,
    PointVector,
    clamp,
    difference,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { ColorScaleManager } from "../color/ColorScale"
import { BASE_FONT_SIZE, GRAPHER_DARK_TEXT } from "../core/GrapherConstants"
import {
    ScaleType,
    SeriesName,
    ColorSchemeName,
    ColumnSlug,
    MissingDataStrategy,
    Time,
    SeriesStrategy,
    EntityName,
    PrimitiveType,
} from "@ourworldindata/types"
import { ChartInterface } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import { scaleLinear, ScaleLinear } from "d3-scale"
import { select } from "d3-selection"
import {
    SlopeChartSeries,
    SlopeChartValue,
    SlopeEntryProps,
} from "./SlopeChartConstants"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    getDefaultFailMessage,
    makeSelectionArray,
} from "../chart/ChartUtils"
import { AxisConfig } from "../axis/AxisConfig"
import { VerticalAxis } from "../axis/Axis"
import { VerticalAxisComponent } from "../axis/AxisViews"
import { NoDataSection } from "../scatterCharts/NoDataSection"
import { CategoricalColorAssigner } from "../color/CategoricalColorAssigner"
import { ColorScheme } from "../color/ColorScheme"
import { ColorSchemes } from "../color/ColorSchemes"
import { LineLabelSeries, LineLegend } from "../lineLegend/LineLegend"

export interface SlopeChartManager extends ChartManager {
    isModalOpen?: boolean
    canSelectMultipleEntities?: boolean
}

const TOP_PADDING = 6
const BOTTOM_PADDING = 20

@observer
export class SlopeChart
    extends React.Component<{
        bounds?: Bounds
        manager: SlopeChartManager
    }>
    implements ChartInterface, ColorScaleManager
{
    base: React.RefObject<SVGGElement> = React.createRef()

    // currently hovered individual series key
    @observable hoverKey?: string

    transformTable(table: OwidTable) {
        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        if (this.isLogScale)
            table = table.replaceNonPositiveCellsForLogScale(this.yColumnSlugs)

        // drop all data when the author chose to hide entities with missing data and
        // at least one of the variables has no data for the current entity
        if (
            this.missingDataStrategy === MissingDataStrategy.hide &&
            table.hasAnyColumnNoValidValue(this.yColumnSlugs)
        ) {
            table = table.dropAllRows()
        }

        return table

        // TODO: re-enable?
        // return table
        //     .dropRowsWithErrorValuesForColumn(this.yColumnSlug)
        //     .interpolateColumnWithTolerance(this.yColumnSlug)
    }

    transformTableForSelection(table: OwidTable): OwidTable {
        // if entities with partial data are not plotted,
        // make sure they don't show up in the entity selector
        if (this.missingDataStrategy === MissingDataStrategy.hide) {
            table = table.replaceNonNumericCellsWithErrorValues(
                this.yColumnSlugs
            )

            table = table.dropEntitiesThatHaveNoDataInSomeColumn(
                this.yColumnSlugs
            )
        }

        return table
    }

    @computed get manager() {
        return this.props.manager
    }

    @computed.struct get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get isStatic(): boolean {
        return this.manager.isStatic ?? false
    }

    @computed get fontSize() {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get isPortrait(): boolean {
        return !!(this.manager.isNarrow || this.manager.isStaticAndSmall)
    }

    @computed get isLogScale(): boolean {
        return this.props.manager.yAxisConfig?.scaleType === ScaleType.log
    }

    @computed private get missingDataStrategy(): MissingDataStrategy {
        return this.manager.missingDataStrategy || MissingDataStrategy.auto
    }

    @action.bound onSlopeMouseOver(slopeProps: SlopeEntryProps) {
        this.hoverKey = slopeProps.seriesName
    }

    @action.bound onSlopeMouseLeave() {
        this.hoverKey = undefined
    }

    @computed private get selectionArray() {
        return makeSelectionArray(this.manager.selection)
    }

    @computed private get selectedEntityNames() {
        return this.selectionArray.selectedEntityNames
    }

    @computed private get sidebarWidth(): number {
        return Math.min(120, 0.15 * this.bounds.width)
    }

    @computed private get innerBounds() {
        const { sidebarWidth } = this
        let bounds = this.bounds
        if (this.showNoDataSection) {
            bounds = bounds.padRight(sidebarWidth + 16)
        }
        return bounds
    }

    @computed
    private get selectedEntitiesWithoutData(): string[] {
        return difference(
            this.selectedEntityNames,
            this.series.map((s) => s.seriesName)
        )
    }

    @computed private get showNoDataSection(): boolean {
        // TODO: for now, only show missing data section for entities
        return (
            this.seriesStrategy === SeriesStrategy.entity &&
            this.selectedEntitiesWithoutData.length > 0
        )
    }

    @computed private get noDataSection(): React.ReactElement {
        const bounds = new Bounds(
            this.bounds.right - this.sidebarWidth,
            this.bounds.top,
            this.sidebarWidth,
            this.bounds.height
        )
        return (
            <NoDataSection
                entityNames={this.selectedEntitiesWithoutData}
                bounds={bounds}
                baseFontSize={this.fontSize}
            />
        )
    }

    // used by LineLegend
    @computed get focusedSeriesNames(): string[] {
        return this.hoverKey ? [this.hoverKey] : []
    }

    // Layered mode occurs when any entity on the chart is hovered or focused
    // Then, a special "foreground" set of entities is rendered over the background
    @computed private get isLayerMode() {
        return this.hoverKey !== undefined
    }

    @computed private get formatColumn() {
        return this.yColumns[0]
    }

    @computed get allowedLabelWidth() {
        return this.bounds.width * 0.2
    }

    @computed get maxLabelWidth(): number {
        // const maxLabelWidths = this.series.map((slope) => {
        //     const entityLabelWidth = slope.leftEntityLabel.width
        //     const maxValueLabelWidth = Math.max(
        //         slope.leftValueLabel.width,
        //         slope.rightValueLabel.width
        //     )
        //     return (
        //         entityLabelWidth +
        //         maxValueLabelWidth +
        //         LABEL_SLOPE_PADDING +
        //         LABEL_LABEL_PADDING
        //     )
        // })
        // return max(maxLabelWidths) ?? 0
        return 100 // TODO: remove?
    }

    @computed private get initialSlopeData() {
        const { series, xScale, yAxis, yDomain } = this

        const slopeData: SlopeEntryProps[] = []

        series.forEach((series) => {
            // Ensure values fit inside the chart
            if (
                !series.values.every(
                    (d) => d.y >= yDomain[0] && d.y <= yDomain[1]
                )
            )
                return

            const [v1, v2] = series.values
            const [x1, x2] = [xScale(v1.x), xScale(v2.x)]
            const [y1, y2] = [yAxis.place(v1.y), yAxis.place(v2.y)]

            slopeData.push({
                x1,
                y1,
                x2,
                y2,
                color: series.color,
                seriesName: series.seriesName,
                isHovered: false,
            } as SlopeEntryProps)
        })

        return slopeData
    }

    mouseFrame?: number
    @action.bound onMouseLeave() {
        if (this.mouseFrame !== undefined) cancelAnimationFrame(this.mouseFrame)

        this.onSlopeMouseLeave()
    }

    @action.bound onMouseMove(
        ev: React.MouseEvent<SVGGElement> | React.TouchEvent<SVGGElement>
    ) {
        if (this.base.current) {
            const mouse = getRelativeMouse(this.base.current, ev.nativeEvent)

            this.mouseFrame = requestAnimationFrame(() => {
                if (this.innerBounds.contains(mouse)) {
                    if (this.slopeData.length === 0) return

                    const { x1: startX, x2: endX } = this.slopeData[0]

                    // whether the mouse is over the chart area,
                    // the left label area, or the right label area
                    const mousePosition =
                        mouse.x < startX
                            ? "left"
                            : mouse.x > endX
                              ? "right"
                              : "chart"

                    // don't track mouse movements when hovering over labels on the left or right
                    if (mousePosition === "left" || mousePosition === "right") {
                        this.onSlopeMouseLeave()
                        return
                    }

                    const distToSlopeOrLabel = new Map<
                        SlopeEntryProps,
                        number
                    >()
                    for (const s of this.slopeData) {
                        // start and end point of a line
                        const p1 = new PointVector(s.x1, s.y1)
                        const p2 = new PointVector(s.x2, s.y2)

                        // calculate the distance to the slope or label
                        const dist =
                            PointVector.distanceFromPointToLineSegmentSq(
                                mouse,
                                p1,
                                p2
                            )
                        distToSlopeOrLabel.set(s, dist)
                    }

                    const closestSlope = minBy(this.slopeData, (s) =>
                        distToSlopeOrLabel.get(s)
                    )
                    const distanceSq = distToSlopeOrLabel.get(closestSlope!)!
                    const tolerance = mousePosition === "chart" ? 20 : 10
                    const toleranceSq = tolerance * tolerance

                    if (closestSlope && distanceSq < toleranceSq) {
                        this.onSlopeMouseOver(closestSlope)
                    } else {
                        this.onSlopeMouseLeave()
                    }
                }
            })
        }
    }

    // Get the final slope data with hover focusing and collision detection
    @computed get slopeData(): SlopeEntryProps[] {
        let slopeData = this.initialSlopeData

        slopeData = slopeData.map((slope) => {
            // used to determine priority for labelling conflicts
            const isHovered = this.hoverKey === slope.seriesName

            return {
                ...slope,
                isHovered,
            }
        })

        // Order by focus/hover for draw order
        slopeData = sortBy(slopeData, (slope) => (slope.isHovered ? 1 : 0))

        return slopeData
    }

    private renderGroups(groups: SlopeEntryProps[]) {
        const { isLayerMode } = this

        return groups.map((slope) => (
            <SlopeEntry
                key={slope.seriesName}
                {...slope}
                isLayerMode={isLayerMode}
            />
        ))
    }

    private renderLabelledSlopes() {
        const { bounds, slopeData, xDomain, yAxis, yRange, onMouseMove } = this

        if (isEmpty(slopeData))
            return <NoDataModal manager={this.props.manager} bounds={bounds} />

        const { x1, x2 } = slopeData[0]
        const [y1, y2] = yRange

        return (
            <g
                className="LabelledSlopes"
                ref={this.base}
                onMouseMove={onMouseMove}
                onTouchMove={onMouseMove}
                onTouchStart={onMouseMove}
                onMouseLeave={this.onMouseLeave}
            >
                <rect
                    x={bounds.x}
                    y={bounds.y}
                    width={bounds.width}
                    height={bounds.height}
                    fill="rgba(255,255,255,0)"
                    opacity={0}
                />
                <g
                    id={makeIdForHumanConsumption("grid-lines")}
                    className="gridlines"
                >
                    {this.yAxis.tickLabels.map((tick) => {
                        const y = yAxis.place(tick.value)
                        return (
                            <g
                                id={makeIdForHumanConsumption(
                                    "grid-line",
                                    tick.value.toString()
                                )}
                                key={y.toString()}
                            >
                                {/* grid lines connecting the chart area to the axis */}
                                <line
                                    x1={bounds.left + this.yAxis.width + 8}
                                    y1={y}
                                    x2={x1}
                                    y2={y}
                                    stroke="#eee"
                                    strokeDasharray="3,2"
                                />
                                {/* grid lines within the chart area */}
                                <line
                                    x1={x1}
                                    y1={y}
                                    x2={x2}
                                    y2={y}
                                    stroke="#ddd"
                                    strokeDasharray="3,2"
                                />
                            </g>
                        )
                    })}
                </g>
                <VerticalAxisComponent
                    bounds={bounds}
                    verticalAxis={this.yAxis}
                    showTickMarks={true}
                    labelColor={this.manager.secondaryColorInStaticCharts}
                />
                <line x1={x1} y1={y1} x2={x1} y2={y2} stroke="#999" />
                <line x1={x2} y1={y1} x2={x2} y2={y2} stroke="#999" />
                <text
                    x={x1}
                    y={y1 + BOTTOM_PADDING - 2}
                    textAnchor="middle"
                    fill={GRAPHER_DARK_TEXT}
                    fontSize={this.yAxis.tickFontSize}
                >
                    {this.formatColumn.formatTime(xDomain[0])}
                </text>
                <text
                    x={x2}
                    y={y1 + BOTTOM_PADDING - 2}
                    textAnchor="middle"
                    fill={GRAPHER_DARK_TEXT}
                    fontSize={this.yAxis.tickFontSize}
                >
                    {this.formatColumn.formatTime(xDomain[1])}
                </text>
                <g id={makeIdForHumanConsumption("slopes")} className="slopes">
                    {this.renderGroups(this.backgroundGroups)}
                    {this.renderGroups(this.foregroundGroups)}
                </g>
            </g>
        )
    }

    @computed get backgroundGroups() {
        return this.slopeData.filter((group) => !group.isHovered)
    }

    @computed get foregroundGroups() {
        return this.slopeData.filter((group) => !!group.isHovered)
    }

    private playIntroAnimation() {
        // Nice little intro animation
        select(this.base.current)
            .select(".slopes")
            .attr("stroke-dasharray", "100%")
            .attr("stroke-dashoffset", "100%")
            .transition()
            .attr("stroke-dashoffset", "0%")
    }

    render() {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.failMessage}
                />
            )

        const { manager } = this.props

        return (
            <g
                id={makeIdForHumanConsumption("slope-chart")}
                className="slopeChart"
            >
                {this.renderLabelledSlopes()}
                {manager.showLegend && <LineLegend manager={this} />}
                {this.showNoDataSection && this.noDataSection}
            </g>
        )
    }

    @computed get failMessage() {
        const message = getDefaultFailMessage(this.manager)
        if (message) return message
        else if (isEmpty(this.series)) return "No matching data"
        return ""
    }

    defaultBaseColorScheme = ColorSchemeName.OwidDistinctLines

    @computed private get yColumns(): CoreColumn[] {
        return this.yColumnSlugs.map((slug) => this.transformedTable.get(slug))
    }

    @computed protected get yColumnSlugs(): ColumnSlug[] {
        return autoDetectYColumnSlugs(this.manager)
    }

    @computed get transformedTableFromGrapher(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed get transformedTable(): OwidTable {
        let table = this.transformedTableFromGrapher
        // The % growth transform cannot be applied in transformTable() because it will filter out
        // any rows before startHandleTimeBound and change the timeline bounds.
        const { isRelativeMode, startHandleTimeBound } = this.manager
        if (isRelativeMode && startHandleTimeBound !== undefined) {
            table = table.toTotalGrowthForEachColumnComparedToStartTime(
                startHandleTimeBound,
                this.yColumnSlugs ?? []
            )
        }
        return table
    }

    @computed get inputTable() {
        return this.manager.table
    }

    componentDidMount() {
        exposeInstanceOnWindow(this)

        if (!this.manager.disableIntroAnimation) {
            this.playIntroAnimation()
        }
    }

    @computed private get colorScheme(): ColorScheme {
        return (
            (this.manager.baseColorScheme
                ? ColorSchemes.get(this.manager.baseColorScheme)
                : null) ?? ColorSchemes.get(this.defaultBaseColorScheme)
        )
    }

    @computed private get startTime(): Time {
        return this.transformedTable.minTime
    }

    @computed private get endTime(): Time {
        return this.transformedTable.maxTime! // TODO: remove the ! when we have a better way to handle missing maxTime
    }

    @computed get seriesStrategy(): SeriesStrategy {
        return autoDetectSeriesStrategy(this.manager, true)
    }

    @computed private get categoricalColorAssigner(): CategoricalColorAssigner {
        return new CategoricalColorAssigner({
            colorScheme: this.colorScheme,
            invertColorScheme: this.manager.invertColorScheme,
            colorMap:
                this.seriesStrategy === SeriesStrategy.entity
                    ? this.inputTable.entityNameColorIndex
                    : this.inputTable.columnDisplayNameToColorMap,
            autoColorMapCache: this.manager.seriesColorMap,
        })
    }

    private getSeriesName(
        entityName: EntityName,
        columnName: string,
        entityCount: number
    ): SeriesName {
        if (this.seriesStrategy === SeriesStrategy.entity) {
            return entityName
        }
        if (entityCount > 1 || this.manager.canSelectMultipleEntities) {
            return `${entityName} - ${columnName}`
        } else {
            return columnName
        }
    }

    // todo: for now just works with 1 y column
    @computed private get annotationsMap(): Map<
        PrimitiveType,
        Set<PrimitiveType>
    > {
        return this.inputTable
            .getAnnotationColumnForColumn(this.yColumnSlugs[0])
            ?.getUniqueValuesGroupedBy(this.inputTable.entityNameSlug)
    }

    private getAnnotationsForSeries(
        seriesName: SeriesName
    ): string | undefined {
        const annotationsMap = this.annotationsMap
        const annos = annotationsMap?.get(seriesName)
        return annos
            ? Array.from(annos.values())
                  .filter((anno) => anno)
                  .join(" & ")
            : undefined
    }

    private getColorKey(
        entityName: EntityName,
        columnName: string,
        entityCount: number
    ): SeriesName {
        if (this.seriesStrategy === SeriesStrategy.entity) {
            return entityName
        }
        // If only one entity is plotted, we want to use the column colors.
        // Unlike in `getSeriesName`, we don't care whether the user can select
        // multiple entities, only whether more than one is plotted.
        if (entityCount > 1) {
            return `${entityName} - ${columnName}`
        } else {
            return columnName
        }
    }

    @computed get series() {
        const { startTime, endTime } = this
        const totalEntityCount =
            this.transformedTable.availableEntityNames.length
        return this.yColumns.flatMap((column) =>
            column.uniqEntityNames
                .map((entityName) => {
                    const seriesName = this.getSeriesName(
                        entityName,
                        column.displayName || "Missing name",
                        totalEntityCount
                    )

                    const values: SlopeChartValue[] = []

                    const yValues =
                        column.valueByEntityNameAndOriginalTime.get(
                            entityName
                        )! || []

                    yValues.forEach((value, time) => {
                        if (time !== startTime && time !== endTime) return

                        values.push({
                            x: time,
                            y: value,
                        })
                    })

                    // sort values by time
                    const sortedValues = sortBy(values, (v) => v.x)

                    const color = this.categoricalColorAssigner.assign(
                        this.getColorKey(
                            entityName,
                            column.displayName,
                            totalEntityCount
                        )
                    )

                    const annotation = this.getAnnotationsForSeries(seriesName)

                    return {
                        seriesName,
                        color,
                        values: sortedValues,
                        annotation,
                    } as SlopeChartSeries
                })
                .filter((series) => series.values.length >= 2)
        )
    }

    @observable private hoverTimer?: NodeJS.Timeout

    @action.bound onLineLegendMouseOver(seriesName: SeriesName): void {
        clearTimeout(this.hoverTimer)
        this.hoverKey = seriesName
    }

    @action.bound clearHighlightedSeries(): void {
        clearTimeout(this.hoverTimer)
        this.hoverTimer = setTimeout(() => {
            // wait before clearing selection in case the mouse is moving quickly over neighboring labels
            this.hoverKey = undefined
        }, 200)
    }

    @action.bound onLineLegendMouseLeave(): void {
        this.clearHighlightedSeries()
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    @computed private get allValues() {
        return this.series.flatMap((g) => g.values)
    }

    @computed private get yScaleType() {
        return this.yAxisConfig.scaleType || ScaleType.linear
    }

    @computed private get yDomainDefault(): [number, number] {
        return domainExtent(
            this.allValues.map((v) => v.y),
            this.yScaleType || ScaleType.linear
        )
    }

    @computed private get yDomain(): [number, number] {
        const domain = this.yAxisConfig.domain || [Infinity, -Infinity]
        const domainDefault = this.yDomainDefault
        return [
            Math.min(domain[0], domainDefault[0]),
            Math.max(domain[1], domainDefault[1]),
        ]
    }

    @computed get yRange(): [number, number] {
        return this.bounds
            .padTop(TOP_PADDING)
            .padBottom(BOTTOM_PADDING)
            .yRange()
    }

    @computed get yAxis(): VerticalAxis {
        const axis = this.yAxisConfig.toVerticalAxis()
        axis.domain = this.yDomain
        axis.range = this.yRange
        axis.formatColumn = this.yColumns[0]
        axis.label = ""
        return axis
    }

    @computed get yAxisWidth(): number {
        return this.yAxis.width + 5 // 5px account for the tick marks
    }

    @computed get xRange(): [number, number] {
        // take into account the space taken by the yAxis and slope labels
        const bounds = this.bounds
            .padLeft(this.yAxisWidth + 4)
            .padLeft(this.maxLabelWidth)
            .padRight(this.maxLabelWidth)

        // pick a reasonable width based on an ideal aspect ratio
        const idealAspectRatio = 0.9
        const availableWidth = bounds.width
        const idealWidth = idealAspectRatio * bounds.height
        const slopeWidth = this.isPortrait
            ? availableWidth
            : clamp(idealWidth, 220, availableWidth)

        const leftRightPadding = (availableWidth - slopeWidth) / 2
        return bounds
            .padLeft(leftRightPadding)
            .padRight(leftRightPadding)
            .xRange()
    }

    @computed private get xScale(): ScaleLinear<number, number> {
        const { xDomain, xRange } = this
        return scaleLinear().domain(xDomain).range(xRange)
    }

    @computed private get xDomain(): [number, number] {
        return this.xDomainDefault
    }

    @computed private get xDomainDefault(): [number, number] {
        return domainExtent(
            this.allValues.map((v) => v.x),
            ScaleType.linear
        )
    }

    @computed get lineLegendX(): number {
        return this.bounds.right - 240
    }

    @computed get labelSeries(): LineLabelSeries[] {
        return this.series.map((series) => {
            const { seriesName, color, values, annotation } = series
            return {
                color,
                seriesName,
                label: seriesName,
                annotation,
                yValue: values[1].y,
            }
        })
    }
}

@observer
class SlopeEntry extends React.Component<SlopeEntryProps> {
    line: SVGElement | null = null

    @computed get isInBackground() {
        const { isLayerMode, isHovered } = this.props

        if (!isLayerMode) return false

        return !isHovered
    }

    render() {
        const { x1, y1, x2, y2, color, isHovered, seriesName } = this.props
        const { isInBackground } = this

        const lineColor = isInBackground ? "#e2e2e2" : color
        const opacity = isHovered ? 1 : 0.5
        const lineStrokeWidth = isHovered ? 4 : 2

        const showDots = isHovered

        return (
            <g
                id={makeIdForHumanConsumption("slope", seriesName)}
                className="slope"
            >
                <line
                    ref={(el) => (this.line = el)}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={lineColor}
                    strokeWidth={lineStrokeWidth}
                    opacity={opacity}
                />
                {showDots && (
                    <>
                        <circle
                            cx={x1}
                            cy={y1}
                            r={4}
                            fill={lineColor}
                            opacity={opacity}
                        />
                        <circle
                            cx={x2}
                            cy={y2}
                            r={4}
                            fill={lineColor}
                            opacity={opacity}
                        />
                    </>
                )}
            </g>
        )
    }
}
