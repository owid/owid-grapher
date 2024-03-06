import React from "react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    intersection,
    without,
    uniq,
    isEmpty,
    last,
    sortBy,
    max,
    flatten,
    getRelativeMouse,
    domainExtent,
    minBy,
    exposeInstanceOnWindow,
    PointVector,
    clamp,
    HorizontalAlign,
} from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { NoDataModal } from "../noDataModal/NoDataModal"
import {
    VerticalColorLegend,
    VerticalColorLegendManager,
} from "../verticalColorLegend/VerticalColorLegend"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import {
    BASE_FONT_SIZE,
    GRAPHER_DARK_TEXT,
    GRAPHER_FONT_SCALE_9_6,
    GRAPHER_FONT_SCALE_10_5,
} from "../core/GrapherConstants"
import {
    ScaleType,
    EntitySelectionMode,
    Color,
    SeriesName,
    ColorSchemeName,
} from "@ourworldindata/types"
import { ChartInterface } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import { scaleLinear, ScaleLinear } from "d3-scale"
import { extent } from "d3-array"
import { select } from "d3-selection"
import {
    DEFAULT_SLOPE_CHART_COLOR,
    LabelledSlopesProps,
    SlopeChartSeries,
    SlopeChartValue,
    SlopeProps,
} from "./SlopeChartConstants"
import { OwidTable } from "@ourworldindata/core-table"
import { autoDetectYColumnSlugs, makeSelectionArray } from "../chart/ChartUtils"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { VerticalAxis } from "../axis/Axis"
import { VerticalAxisComponent } from "../axis/AxisViews"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
} from "../horizontalColorLegend/HorizontalColorLegends"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"

export interface SlopeChartManager extends ChartManager {
    isModalOpen?: boolean
    isSemiNarrow?: boolean
}

const LABEL_SLOPE_PADDING = 8
const LABEL_LABEL_PADDING = 4

const TOP_PADDING = 6
const BOTTOM_PADDING = 20

@observer
export class SlopeChart
    extends React.Component<{
        bounds?: Bounds
        manager: SlopeChartManager
    }>
    implements
        ChartInterface,
        VerticalColorLegendManager,
        HorizontalColorLegendManager,
        ColorScaleManager
{
    // currently hovered individual series key
    @observable hoverKey?: string
    // currently hovered legend color
    @observable hoverColor?: string

    transformTable(table: OwidTable) {
        if (!table.has(this.yColumnSlug)) return table

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues([this.yColumnSlug])

        return table
            .dropRowsWithErrorValuesForColumn(this.yColumnSlug)
            .interpolateColumnWithTolerance(this.yColumnSlug)
    }

    @computed get manager() {
        return this.props.manager
    }

    @computed.struct get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get fontSize() {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get isPortrait(): boolean {
        return !!(this.manager.isNarrow || this.manager.isStaticAndSmall)
    }

    @computed private get showHorizontalLegend(): boolean {
        return !!(this.manager.isSemiNarrow || this.manager.isStaticAndSmall)
    }

    // used by the <VerticalColorLegend /> component
    @computed get legendItems() {
        return this.colorScale.legendBins
            .filter((bin) => this.colorsInUse.includes(bin.color))
            .map((bin) => {
                return {
                    key: bin.label ?? "",
                    label: bin.label ?? "",
                    color: bin.color,
                }
            })
    }

    // used by the <HorizontalCategoricalColorLegend /> component
    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.legendItems.map(
            (legendItem, index) =>
                new CategoricalBin({
                    ...legendItem,
                    index,
                    value: legendItem.label,
                })
        )
    }

    @action.bound onSlopeMouseOver(slopeProps: SlopeProps) {
        this.hoverKey = slopeProps.seriesName
    }

    @action.bound onSlopeMouseLeave() {
        this.hoverKey = undefined
    }

    @action.bound onSlopeClick() {
        const { hoverKey, isEntitySelectionEnabled } = this
        if (!isEntitySelectionEnabled || hoverKey === undefined) {
            return
        }

        this.selectionArray.toggleSelection(hoverKey)
    }

    @action.bound onLegendMouseOver(binOrColor: string | ColorScaleBin) {
        this.hoverColor =
            typeof binOrColor === "string" ? binOrColor : binOrColor.color
    }

    @action.bound onLegendMouseLeave() {
        this.hoverColor = undefined
    }

    @computed private get selectionArray() {
        return makeSelectionArray(this.manager.selection)
    }

    @computed private get selectedEntityNames() {
        return this.selectionArray.selectedEntityNames
    }

    @computed get isEntitySelectionEnabled(): boolean {
        const { manager } = this
        return !!(
            manager.addCountryMode !== EntitySelectionMode.Disabled &&
            manager.addCountryMode
        )
    }

    // When the color legend is clicked, toggle selection fo all associated keys
    @action.bound onLegendClick() {
        const { hoverColor, isEntitySelectionEnabled } = this
        if (!isEntitySelectionEnabled || hoverColor === undefined) return

        const seriesNamesToToggle = this.series
            .filter((g) => g.color === hoverColor)
            .map((g) => g.seriesName)
        const areAllSeriesActive =
            intersection(seriesNamesToToggle, this.selectedEntityNames)
                .length === seriesNamesToToggle.length
        if (areAllSeriesActive)
            this.selectionArray.setSelectedEntities(
                without(this.selectedEntityNames, ...seriesNamesToToggle)
            )
        else
            this.selectionArray.setSelectedEntities(
                this.selectedEntityNames.concat(seriesNamesToToggle)
            )
    }

    // Colors on the legend for which every matching group is focused
    @computed get focusColors() {
        const { colorsInUse } = this
        return colorsInUse.filter((color) => {
            const matchingSeriesNames = this.series
                .filter((g) => g.color === color)
                .map((g) => g.seriesName)
            return (
                intersection(matchingSeriesNames, this.selectedEntityNames)
                    .length === matchingSeriesNames.length
            )
        })
    }

    @computed get focusKeys() {
        return this.selectedEntityNames
    }

    // All currently hovered group keys, combining the legend and the main UI
    @computed.struct get hoverKeys() {
        const { hoverColor, hoverKey } = this

        const hoverKeys =
            hoverColor === undefined
                ? []
                : uniq(
                      this.series
                          .filter((g) => g.color === hoverColor)
                          .map((g) => g.seriesName)
                  )

        if (hoverKey !== undefined) hoverKeys.push(hoverKey)

        return hoverKeys
    }

    // Colors currently on the chart and not greyed out
    @computed get activeColors() {
        const { hoverKeys, focusKeys } = this
        const activeKeys = hoverKeys.concat(focusKeys)

        if (activeKeys.length === 0)
            // No hover or focus means they're all active by default
            return uniq(this.series.map((g) => g.color))

        return uniq(
            this.series
                .filter((g) => activeKeys.indexOf(g.seriesName) !== -1)
                .map((g) => g.color)
        )
    }

    // Only show colors on legend that are actually in use
    @computed private get colorsInUse() {
        return uniq(this.series.map((series) => series.color))
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.left
    }

    @computed get verticalColorLegend(): VerticalColorLegend {
        return new VerticalColorLegend({ manager: this })
    }

    @computed get horizontalColorLegend(): HorizontalCategoricalColorLegend {
        return new HorizontalCategoricalColorLegend({ manager: this })
    }

    @computed get legendHeight(): number {
        return this.showHorizontalLegend
            ? this.horizontalColorLegend.height
            : this.verticalColorLegend.height
    }

    @computed get legendWidth(): number {
        return this.showHorizontalLegend
            ? this.bounds.width
            : this.verticalColorLegend.width
    }

    @computed get maxLegendWidth(): number {
        return this.showHorizontalLegend
            ? this.bounds.width
            : this.bounds.width * 0.5
    }

    @computed.struct private get sidebarWidth() {
        return Math.min(this.legendWidth, this.maxLegendWidth)
    }

    // correction is to account for the space taken by the legend
    @computed private get innerBounds() {
        const { sidebarWidth, showLegend, legendHeight } = this
        let bounds = this.bounds
        if (showLegend) {
            bounds = this.showHorizontalLegend
                ? bounds.padTop(legendHeight + 8)
                : bounds.padRight(sidebarWidth + 16)
        }
        return bounds
    }

    // verify the validity of data used to show legend
    // this is for backwards compatibility with charts that were added without legend
    // eg: https://ourworldindata.org/grapher/mortality-rate-improvement-by-cohort
    @computed private get showLegend() {
        const { colorsInUse } = this
        const { legendBins } = this.colorScale
        return legendBins.some((bin) => colorsInUse.includes(bin.color))
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
        const {
            series,
            focusKeys,
            hoverKeys,
            innerBounds,
            showLegend,
            showHorizontalLegend,
        } = this

        const legend = showHorizontalLegend ? (
            <HorizontalCategoricalColorLegend manager={this} />
        ) : (
            <VerticalColorLegend manager={this} />
        )

        return (
            <g className="slopeChart">
                <LabelledSlopes
                    manager={manager}
                    bounds={innerBounds}
                    yColumn={this.yColumn!}
                    seriesArr={series}
                    focusKeys={focusKeys}
                    hoverKeys={hoverKeys}
                    onMouseOver={this.onSlopeMouseOver}
                    onMouseLeave={this.onSlopeMouseLeave}
                    onClick={this.onSlopeClick}
                    isPortrait={this.isPortrait}
                />
                {showLegend && legend}
            </g>
        )
    }

    @computed get legendY() {
        return this.bounds.top
    }

    @computed get legendX(): number {
        return this.showHorizontalLegend
            ? this.bounds.left
            : this.bounds.right - this.sidebarWidth
    }

    @computed get failMessage() {
        if (this.yColumn.isMissing) return "Missing Y column"
        else if (isEmpty(this.series)) return "No matching data"
        return ""
    }

    colorScale = this.props.manager.colorScaleOverride ?? new ColorScale(this)

    @computed get colorScaleConfig() {
        return this.manager.colorScale
    }

    @computed get colorScaleColumn() {
        return (
            // For faceted charts, we have to get the values of inputTable before it's filtered by
            // the faceting logic.
            this.manager.colorScaleColumnOverride ?? this.colorColumn
        )
    }

    defaultBaseColorScheme = ColorSchemeName.continents

    @computed private get yColumn() {
        return this.transformedTable.get(this.yColumnSlug)
    }

    @computed protected get yColumnSlug() {
        return autoDetectYColumnSlugs(this.manager)[0]
    }

    @computed private get colorColumn() {
        // NB: This is tricky. Often it seems we use the Continent variable (123) for colors, but we only have 1 year for that variable, which
        // would likely get filtered by any time filtering. So we need to jump up to the root table to get the color values we want.
        // We should probably refactor this as part of a bigger color refactoring.
        return this.inputTable.get(this.manager.colorColumnSlug)
    }

    @computed get transformedTable() {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed get inputTable() {
        return this.manager.table
    }

    // helper method to directly get the associated color value given an Entity
    // dimension data saves color a level deeper. eg: { Afghanistan => { 2015: Asia|Color }}
    // this returns that data in the form { Afghanistan => Asia }
    @computed private get colorBySeriesName(): Map<
        SeriesName,
        Color | undefined
    > {
        const { colorScale, colorColumn } = this
        if (colorColumn.isMissing) return new Map()

        const colorByEntity = new Map<SeriesName, Color | undefined>()

        colorColumn.valueByEntityNameAndOriginalTime.forEach(
            (timeToColorMap, seriesName) => {
                const values = Array.from(timeToColorMap.values())
                const key = last(values)
                colorByEntity.set(seriesName, colorScale.getColor(key))
            }
        )

        return colorByEntity
    }

    @computed private get sizeColumn() {
        return this.transformedTable.get(this.manager.sizeColumnSlug)
    }

    // helper method to directly get the associated size value given an Entity
    // dimension data saves size a level deeper. eg: { Afghanistan => { 1990: 1, 2015: 10 }}
    // this returns that data in the form { Afghanistan => 1 }
    @computed private get sizeByEntity(): Map<string, any> {
        const sizeCol = this.sizeColumn
        const sizeByEntity = new Map<string, any>()

        if (sizeCol)
            sizeCol.valueByEntityNameAndOriginalTime.forEach(
                (timeToSizeMap, entity) => {
                    const values = Array.from(timeToSizeMap.values())
                    sizeByEntity.set(entity, values[0]) // hack: default to the value associated with the first time
                }
            )

        return sizeByEntity
    }

    // click anywhere inside the Grapher frame to dismiss the current selection
    @action.bound onGrapherClick(e: Event): void {
        const target = e.target as HTMLElement

        // check if the target is an interactive element or contained within one
        const selector = "a, button, input, .TimelineComponent"
        const isTargetInteractive = target.closest(selector) !== null

        if (
            this.isEntitySelectionEnabled &&
            !this.hoverKey &&
            !this.hoverColor &&
            !this.manager.isModalOpen &&
            !isTargetInteractive
        ) {
            this.selectionArray.clearSelection()
        }
    }

    @computed private get grapherElement() {
        return this.manager.base?.current
    }

    componentDidMount() {
        if (this.grapherElement) {
            this.grapherElement.addEventListener("click", this.onGrapherClick)
        }
        exposeInstanceOnWindow(this)
    }

    componentWillUnmount(): void {
        if (this.grapherElement) {
            this.grapherElement.removeEventListener(
                "click",
                this.onGrapherClick
            )
        }
    }

    @computed get series() {
        const column = this.yColumn
        if (!column) return []

        const { colorBySeriesName, sizeByEntity } = this
        const { minTime, maxTime } = column

        const table = this.inputTable

        return column.uniqEntityNames
            .map((seriesName) => {
                const values: SlopeChartValue[] = []

                const yValues =
                    column.valueByEntityNameAndOriginalTime.get(seriesName)! ||
                    []

                yValues.forEach((value, time) => {
                    if (time !== minTime && time !== maxTime) return

                    values.push({
                        x: time,
                        y: value,
                    })
                })

                // sort values by time
                const sortedValues = sortBy(values, (v) => v.x)

                const color =
                    table.getColorForEntityName(seriesName) ??
                    colorBySeriesName.get(seriesName) ??
                    DEFAULT_SLOPE_CHART_COLOR

                return {
                    seriesName,
                    color,
                    size: sizeByEntity.get(seriesName) || 1,
                    values: sortedValues,
                } as SlopeChartSeries
            })
            .filter((series) => series.values.length >= 2)
    }
}

@observer
class Slope extends React.Component<SlopeProps> {
    line: SVGElement | null = null

    @computed get isInBackground() {
        const { isLayerMode, isHovered, isFocused } = this.props

        if (!isLayerMode) return false

        return !(isHovered || isFocused)
    }

    render() {
        const {
            x1,
            y1,
            x2,
            y2,
            color,
            size,
            hasLeftLabel,
            hasRightLabel,
            leftValueLabel,
            leftEntityLabel,
            rightValueLabel,
            rightEntityLabel,
            leftEntityLabelBounds,
            rightEntityLabelBounds,
            isFocused,
            isHovered,
            isMultiHoverMode,
        } = this.props
        const { isInBackground } = this

        const lineColor = isInBackground ? "#e2e2e2" : color
        const labelColor = isInBackground ? "#ccc" : GRAPHER_DARK_TEXT
        const opacity = isHovered ? 1 : isFocused ? 0.7 : 0.5
        const lineStrokeWidth = isHovered
            ? size * 2
            : isFocused
            ? 1.5 * size
            : size

        const showDots = isFocused || isHovered
        const showValueLabels = isFocused || isHovered
        const showLeftEntityLabel = isFocused || (isHovered && isMultiHoverMode)

        const sharedLabelProps = {
            fill: labelColor,
            style: { cursor: "default" },
        }

        return (
            <g className="slope">
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
                                fontWeight:
                                    isFocused || isHovered ? "bold" : undefined,
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

    @computed private get yColumn() {
        return this.props.yColumn
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

    @computed private get focusedSeriesNames() {
        return intersection(
            this.props.focusKeys || [],
            this.data.map((g) => g.seriesName)
        )
    }

    @computed private get hoveredSeriesNames() {
        return intersection(
            this.props.hoverKeys || [],
            this.data.map((g) => g.seriesName)
        )
    }

    // Layered mode occurs when any entity on the chart is hovered or focused
    // Then, a special "foreground" set of entities is rendered over the background
    @computed private get isLayerMode() {
        return (
            this.focusedSeriesNames.length > 0 ||
            this.hoveredSeriesNames.length > 0
        )
    }

    @computed private get isMultiHoverMode() {
        return this.hoveredSeriesNames.length > 1
    }

    @computed get isPortrait(): boolean {
        return this.props.isPortrait
    }

    @computed private get allValues() {
        return flatten(this.props.seriesArr.map((g) => g.values))
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
        axis.formatColumn = this.yColumn
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

    @computed get sizeScale(): ScaleLinear<number, number> {
        const factor = this.manager.isStaticAndSmall ? 1.2 : 1
        return scaleLinear()
            .domain(
                extent(this.props.seriesArr.map((series) => series.size)) as [
                    number,
                    number,
                ]
            )
            .range([factor, 4 * factor])
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
        const { isPortrait, yColumn, allowedLabelWidth: maxWidth } = this

        return this.data.map((series) => {
            const text = series.seriesName
            const [v1, v2] = series.values
            const fontSize =
                (isPortrait
                    ? GRAPHER_FONT_SCALE_9_6
                    : GRAPHER_FONT_SCALE_10_5) * this.fontSize
            const leftValueStr = yColumn.formatValueShort(v1.y)
            const rightValueStr = yColumn.formatValueShort(v2.y)

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
        const { data, slopeLabels, xScale, yAxis, yDomain, sizeScale } = this

        const slopeData: SlopeProps[] = []

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
                size: sizeScale(series.size) || 1,
                seriesName: series.seriesName,
                isFocused: false,
                isHovered: false,
                hasLeftLabel: true,
                hasRightLabel: true,
            } as SlopeProps)
        })

        return slopeData
    }

    @computed get backgroundGroups() {
        return this.slopeData.filter(
            (group) => !(group.isHovered || group.isFocused)
        )
    }

    @computed get foregroundGroups() {
        return this.slopeData.filter(
            (group) => !!(group.isHovered || group.isFocused)
        )
    }

    // Get the final slope data with hover focusing and collision detection
    @computed get slopeData(): SlopeProps[] {
        const { focusedSeriesNames, hoveredSeriesNames } = this

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
            const isFocused = focusedSeriesNames.includes(slope.seriesName)
            const isHovered = hoveredSeriesNames.includes(slope.seriesName)

            return {
                ...slope,
                leftEntityLabelBounds,
                rightEntityLabelBounds,
                isFocused,
                isHovered,
            }
        })

        // How to work out which of two slopes to prioritize for labelling conflicts
        function chooseLabel(s1: SlopeProps, s2: SlopeProps) {
            if (s1.isHovered && !s2.isHovered)
                // Hovered slopes always have priority
                return s1
            else if (!s1.isHovered && s2.isHovered) return s2
            else if (s1.isFocused && !s2.isFocused)
                // Focused slopes are next in priority
                return s1
            else if (!s1.isFocused && s2.isFocused) return s2
            else if (s1.hasLeftLabel && !s2.hasLeftLabel)
                // Slopes which already have one label are prioritized for the other side
                return s1
            else if (!s1.hasLeftLabel && s2.hasLeftLabel) return s2
            else if (s1.size > s2.size)
                // Larger sizes get the next priority
                return s1
            else if (s2.size > s1.size) return s2
            else return s1 // Equal priority, just do the first one
        }

        // Eliminate overlapping labels, one pass for each side
        slopeData.forEach((s1) => {
            slopeData.forEach((s2) => {
                if (
                    s1 !== s2 &&
                    s1.hasLeftLabel &&
                    s2.hasLeftLabel &&
                    // entity labels don't necessarily share the same y position.
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

        slopeData.forEach((s1) => {
            slopeData.forEach((s2) => {
                if (
                    s1 !== s2 &&
                    s1.hasRightLabel &&
                    s2.hasRightLabel &&
                    // entity labels don't necessarily share the same y position.
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

        // Order by focus/hover and size for draw order
        slopeData = sortBy(slopeData, (slope) => slope.size)
        slopeData = sortBy(slopeData, (slope) =>
            slope.isFocused || slope.isHovered ? 1 : 0
        )

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

                    const distToSlopeOrLabel = new Map<SlopeProps, number>()
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

    renderGroups(groups: SlopeProps[]) {
        const { isLayerMode, isMultiHoverMode } = this

        return groups.map((slope) => (
            <Slope
                key={slope.seriesName}
                {...slope}
                isLayerMode={isLayerMode}
                isMultiHoverMode={isMultiHoverMode}
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
                <g className="gridlines">
                    {this.yAxis.tickLabels.map((tick) => {
                        const y = yAxis.place(tick.value)
                        return (
                            <g key={y.toString()}>
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
                    y={y1 + BOTTOM_PADDING}
                    textAnchor="middle"
                    fill={GRAPHER_DARK_TEXT}
                    fontSize={this.yAxis.tickFontSize}
                >
                    {xDomain[0].toString()}
                </text>
                <text
                    x={x2}
                    y={y1 + BOTTOM_PADDING}
                    textAnchor="middle"
                    fill={GRAPHER_DARK_TEXT}
                    fontSize={this.yAxis.tickFontSize}
                >
                    {xDomain[1].toString()}
                </text>
                <g className="slopes">
                    {this.renderGroups(this.backgroundGroups)}
                    {this.renderGroups(this.foregroundGroups)}
                </g>
            </g>
        )
    }
}
