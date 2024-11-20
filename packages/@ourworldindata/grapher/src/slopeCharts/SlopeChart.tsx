import React from "react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    isEmpty,
    sortBy,
    max,
    getRelativeMouse,
    domainExtent,
    minBy,
    exposeInstanceOnWindow,
    PointVector,
    clamp,
    difference,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { ColorScaleManager } from "../color/ColorScale"
import {
    BASE_FONT_SIZE,
    GRAPHER_DARK_TEXT,
    GRAPHER_FONT_SCALE_9_6,
    GRAPHER_FONT_SCALE_10_5,
} from "../core/GrapherConstants"
import {
    ScaleType,
    SeriesName,
    ColorSchemeName,
    ColumnSlug,
    MissingDataStrategy,
    Time,
    SeriesStrategy,
    EntityName,
} from "@ourworldindata/types"
import { ChartInterface } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import { scaleLinear, ScaleLinear } from "d3-scale"
import { select } from "d3-selection"
import {
    LabelledSlopesProps,
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
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { VerticalAxis } from "../axis/Axis"
import { VerticalAxisComponent } from "../axis/AxisViews"
import { NoDataSection } from "../scatterCharts/NoDataSection"
import { CategoricalColorAssigner } from "../color/CategoricalColorAssigner"
import { ColorScheme } from "../color/ColorScheme"
import { ColorSchemes } from "../color/ColorSchemes"

export interface SlopeChartManager extends ChartManager {
    isModalOpen?: boolean
    canSelectMultipleEntities?: boolean
}

const LABEL_SLOPE_PADDING = 8
const LABEL_LABEL_PADDING = 2

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
    // currently hovered individual series key
    @observable hoverKey?: string

    transformTable(table: OwidTable) {
        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

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
        const { series, hoverKey, innerBounds } = this

        return (
            <g
                id={makeIdForHumanConsumption("slope-chart")}
                className="slopeChart"
            >
                <LabelledSlopes
                    manager={manager}
                    bounds={innerBounds}
                    formatColumn={this.yColumns[0]}
                    seriesArr={series}
                    hoverKey={hoverKey}
                    onMouseOver={this.onSlopeMouseOver}
                    onMouseLeave={this.onSlopeMouseLeave}
                    isPortrait={this.isPortrait}
                />
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

                    return {
                        seriesName,
                        color,
                        values: sortedValues,
                    } as SlopeChartSeries
                })
                .filter((series) => series.values.length >= 2)
        )
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
        const {
            x1,
            y1,
            x2,
            y2,
            color,
            hasLeftLabel,
            hasRightLabel,
            leftValueLabel,
            leftEntityLabel,
            rightValueLabel,
            rightEntityLabel,
            leftEntityLabelBounds,
            rightEntityLabelBounds,
            isHovered,
            seriesName,
        } = this.props
        const { isInBackground } = this

        const lineColor = isInBackground ? "#e2e2e2" : color
        const labelColor = isInBackground ? "#ccc" : GRAPHER_DARK_TEXT
        const opacity = isHovered ? 1 : 0.5
        const lineStrokeWidth = isHovered ? 4 : 2

        const showDots = isHovered
        const showValueLabels = isHovered
        const showLeftEntityLabel = isHovered

        const sharedLabelProps = {
            fill: labelColor,
            style: { cursor: "default" },
        }

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
                {/* value label on the left */}
                {hasLeftLabel &&
                    showValueLabels &&
                    leftValueLabel.render(
                        x1 - LABEL_SLOPE_PADDING,
                        leftEntityLabelBounds.y,
                        {
                            textProps: {
                                ...sharedLabelProps,
                                textAnchor: "end",
                            },
                        }
                    )}
                {/* entity label on the left */}
                {hasLeftLabel &&
                    showLeftEntityLabel &&
                    leftEntityLabel.render(
                        // -2px is a minor visual correction
                        leftEntityLabelBounds.x - 2,
                        leftEntityLabelBounds.y,
                        {
                            textProps: {
                                ...sharedLabelProps,
                                textAnchor: "end",
                            },
                        }
                    )}
                {/* value label on the right */}
                {hasRightLabel &&
                    showValueLabels &&
                    rightValueLabel.render(
                        rightEntityLabelBounds.x +
                            rightEntityLabel.width +
                            LABEL_LABEL_PADDING,
                        rightEntityLabelBounds.y,
                        {
                            textProps: sharedLabelProps,
                        }
                    )}
                {/* entity label on the right */}
                {hasRightLabel &&
                    rightEntityLabel.render(
                        rightEntityLabelBounds.x,
                        rightEntityLabelBounds.y,
                        {
                            textProps: {
                                ...sharedLabelProps,
                                fontWeight: isHovered ? "bold" : undefined,
                            },
                        }
                    )}
            </g>
        )
    }
}

@observer
class LabelledSlopes
    extends React.Component<LabelledSlopesProps>
    implements AxisManager
{
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed private get data() {
        return this.props.seriesArr
    }

    @computed private get formatColumn() {
        return this.props.formatColumn
    }

    @computed private get manager() {
        return this.props.manager
    }

    @computed private get bounds() {
        return this.props.bounds
    }

    @computed get fontSize() {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get hoveredSeriesName() {
        return this.props.hoverKey
    }

    // Layered mode occurs when any entity on the chart is hovered or focused
    // Then, a special "foreground" set of entities is rendered over the background
    @computed private get isLayerMode() {
        return this.hoveredSeriesName !== undefined
    }

    @computed get isPortrait(): boolean {
        return this.props.isPortrait
    }

    @computed private get allValues() {
        return this.props.seriesArr.flatMap((g) => g.values)
    }

    @computed private get xDomainDefault(): [number, number] {
        return domainExtent(
            this.allValues.map((v) => v.x),
            ScaleType.linear
        )
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    @computed get yAxis(): VerticalAxis {
        const axis = this.yAxisConfig.toVerticalAxis()
        axis.domain = this.yDomain
        axis.range = this.yRange
        axis.formatColumn = this.formatColumn
        axis.label = ""
        return axis
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

    @computed private get xDomain(): [number, number] {
        return this.xDomainDefault
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

    @computed get maxLabelWidth(): number {
        const { slopeLabels } = this
        const maxLabelWidths = slopeLabels.map((slope) => {
            const entityLabelWidth = slope.leftEntityLabel.width
            const maxValueLabelWidth = Math.max(
                slope.leftValueLabel.width,
                slope.rightValueLabel.width
            )
            return (
                entityLabelWidth +
                maxValueLabelWidth +
                LABEL_SLOPE_PADDING +
                LABEL_LABEL_PADDING
            )
        })
        return max(maxLabelWidths) ?? 0
    }

    @computed get allowedLabelWidth() {
        return this.bounds.width * 0.2
    }

    @computed private get slopeLabels() {
        const { isPortrait, formatColumn, allowedLabelWidth: maxWidth } = this

        return this.data.map((series) => {
            const text = series.seriesName
            const [v1, v2] = series.values
            const fontSize =
                (isPortrait
                    ? GRAPHER_FONT_SCALE_9_6
                    : GRAPHER_FONT_SCALE_10_5) * this.fontSize
            const leftValueStr = formatColumn.formatValueShort(v1.y)
            const rightValueStr = formatColumn.formatValueShort(v2.y)

            // value labels
            const valueLabelProps = {
                maxWidth: Infinity, // no line break
                fontSize,
                lineHeight: 1,
            }
            const leftValueLabel = new TextWrap({
                text: leftValueStr,
                ...valueLabelProps,
            })
            const rightValueLabel = new TextWrap({
                text: rightValueStr,
                ...valueLabelProps,
            })

            // entity labels
            const entityLabelProps = {
                ...valueLabelProps,
                maxWidth,
                fontWeight: 700,
                separators: [" ", "-"],
            }
            const leftEntityLabel = new TextWrap({
                text,
                ...entityLabelProps,
            })
            const rightEntityLabel = new TextWrap({
                text,
                ...entityLabelProps,
            })

            return {
                seriesName: series.seriesName,
                leftValueLabel,
                leftEntityLabel,
                rightValueLabel,
                rightEntityLabel,
            }
        })
    }

    @computed private get initialSlopeData() {
        const { data, slopeLabels, xScale, yAxis, yDomain } = this

        const slopeData: SlopeEntryProps[] = []

        data.forEach((series, i) => {
            // Ensure values fit inside the chart
            if (
                !series.values.every(
                    (d) => d.y >= yDomain[0] && d.y <= yDomain[1]
                )
            )
                return

            const labels = slopeLabels[i]
            const [v1, v2] = series.values
            const [x1, x2] = [xScale(v1.x), xScale(v2.x)]
            const [y1, y2] = [yAxis.place(v1.y), yAxis.place(v2.y)]

            slopeData.push({
                ...labels,
                x1,
                y1,
                x2,
                y2,
                color: series.color,
                seriesName: series.seriesName,
                isHovered: false,
                hasLeftLabel: true,
                hasRightLabel: true,
            } as SlopeEntryProps)
        })

        return slopeData
    }

    @computed get backgroundGroups() {
        return this.slopeData.filter((group) => !group.isHovered)
    }

    @computed get foregroundGroups() {
        return this.slopeData.filter((group) => !!group.isHovered)
    }

    // Get the final slope data with hover focusing and collision detection
    @computed get slopeData(): SlopeEntryProps[] {
        const { hoveredSeriesName } = this

        let slopeData = this.initialSlopeData

        slopeData = slopeData.map((slope) => {
            // used for collision detection
            const leftEntityLabelBounds = new Bounds(
                // labels on the left are placed like this: <entity label> <value label> | <slope>
                slope.x1 -
                    LABEL_SLOPE_PADDING -
                    slope.leftValueLabel.width -
                    LABEL_LABEL_PADDING,
                slope.y1 - slope.leftEntityLabel.lines[0].height / 2,
                slope.leftEntityLabel.width,
                slope.leftEntityLabel.height
            )
            const rightEntityLabelBounds = new Bounds(
                // labels on the left are placed like this: <slope> | <entity label> <value label>
                slope.x2 + LABEL_SLOPE_PADDING,
                slope.y2 - slope.rightEntityLabel.height / 2,
                slope.rightEntityLabel.width,
                slope.rightEntityLabel.height
            )

            // used to determine priority for labelling conflicts
            const isHovered = hoveredSeriesName === slope.seriesName

            return {
                ...slope,
                leftEntityLabelBounds,
                rightEntityLabelBounds,
                isHovered,
            }
        })

        // How to work out which of two slopes to prioritize for labelling conflicts
        function chooseLabel(s1: SlopeEntryProps, s2: SlopeEntryProps) {
            if (s1.isHovered && !s2.isHovered)
                // Hovered slopes always have priority
                return s1
            else if (!s1.isHovered && s2.isHovered) return s2
            else if (s1.hasRightLabel && !s2.hasRightLabel)
                // Slopes which already have one label are prioritized for the other side
                return s1
            else if (!s1.hasRightLabel && s2.hasRightLabel) return s2
            else return s1 // Equal priority, just do the first one
        }

        // Eliminate overlapping labels, one pass for each side
        slopeData.forEach((s1) => {
            slopeData.forEach((s2) => {
                if (
                    s1 !== s2 &&
                    s1.hasRightLabel &&
                    s2.hasRightLabel &&
                    // entity labels don't necessarily share the same x position.
                    // that's why we check for vertical intersection only
                    s1.rightEntityLabelBounds.hasVerticalOverlap(
                        s2.rightEntityLabelBounds
                    )
                ) {
                    if (chooseLabel(s1, s2) === s1) s2.hasRightLabel = false
                    else s1.hasRightLabel = false
                }
            })
        })

        slopeData.forEach((s1) => {
            slopeData.forEach((s2) => {
                if (
                    s1 !== s2 &&
                    s1.hasLeftLabel &&
                    s2.hasLeftLabel &&
                    // entity labels don't necessarily share the same x position.
                    // that's why we check for vertical intersection only
                    s1.leftEntityLabelBounds.hasVerticalOverlap(
                        s2.leftEntityLabelBounds
                    )
                ) {
                    if (chooseLabel(s1, s2) === s1) s2.hasLeftLabel = false
                    else s1.hasLeftLabel = false
                }
            })
        })

        // Order by focus/hover for draw order
        slopeData = sortBy(slopeData, (slope) => (slope.isHovered ? 1 : 0))

        return slopeData
    }

    mouseFrame?: number
    @action.bound onMouseLeave() {
        if (this.mouseFrame !== undefined) cancelAnimationFrame(this.mouseFrame)

        if (this.props.onMouseLeave) this.props.onMouseLeave()
    }

    @action.bound onMouseMove(
        ev: React.MouseEvent<SVGGElement> | React.TouchEvent<SVGGElement>
    ) {
        if (this.base.current) {
            const mouse = getRelativeMouse(this.base.current, ev.nativeEvent)

            this.mouseFrame = requestAnimationFrame(() => {
                if (this.props.bounds.contains(mouse)) {
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

                    // don't track mouse movements when hovering over labels on the left
                    if (mousePosition === "left") {
                        this.props.onMouseLeave()
                        return
                    }

                    const distToSlopeOrLabel = new Map<
                        SlopeEntryProps,
                        number
                    >()
                    for (const s of this.slopeData) {
                        // start and end point of a line
                        let p1: PointVector
                        let p2: PointVector

                        if (mousePosition === "chart") {
                            // points define the slope line
                            p1 = new PointVector(s.x1, s.y1)
                            p2 = new PointVector(s.x2, s.y2)
                        } else {
                            const labelBox = s.rightEntityLabelBounds.toProps()
                            // points define a "strike-through" line that stretches from
                            // the end point of the slopes to the right side of the right label
                            const y = labelBox.y + labelBox.height / 2
                            p1 = new PointVector(endX, y)
                            p2 = new PointVector(labelBox.x + labelBox.width, y)
                        }

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

                    if (
                        closestSlope &&
                        distanceSq < toleranceSq &&
                        this.props.onMouseOver
                    ) {
                        this.props.onMouseOver(closestSlope)
                    } else {
                        this.props.onMouseLeave()
                    }
                }
            })
        }
    }

    @action.bound onClick() {
        if (this.props.onClick) this.props.onClick()
    }

    componentDidMount() {
        if (!this.manager.disableIntroAnimation) {
            this.playIntroAnimation()
        }
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

    renderGroups(groups: SlopeEntryProps[]) {
        const { isLayerMode } = this

        return groups.map((slope) => (
            <SlopeEntry
                key={slope.seriesName}
                {...slope}
                isLayerMode={isLayerMode}
            />
        ))
    }

    render() {
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
                onClick={this.onClick}
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
}
