import * as React from "react"
import {
    intersection,
    without,
    uniq,
    isEmpty,
    last,
    sortBy,
    max,
    flatten,
    SVGElement,
    getRelativeMouse,
    domainExtent,
    minBy,
    maxBy,
} from "grapher/utils/Util"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { NoDataModal } from "grapher/chart/NoDataModal"
import {
    VerticalColorLegend,
    VerticalColorLegendManager,
} from "grapher/verticalColorLegend/VerticalColorLegend"
import { ColorScale, ColorScaleManager } from "grapher/color/ColorScale"
import {
    BASE_FONT_SIZE,
    Time,
    ScaleType,
    EntitySelectionModes,
} from "grapher/core/GrapherConstants"
import { ChartInterface } from "grapher/chart/ChartInterface"
import { ChartManager } from "grapher/chart/ChartManager"
import { scaleLinear, scaleLog, ScaleLinear, ScaleLogarithmic } from "d3-scale"
import { extent } from "d3-array"
import { select } from "d3-selection"
import { Text } from "grapher/text/Text"
import { TextWrap } from "grapher/text/TextWrap"
import { ScaleSelector } from "grapher/controls/ScaleSelector"
import {
    LabelledSlopesProps,
    SlopeAxisProps,
    SlopeChartSeries,
    SlopeChartValue,
    SlopeProps,
} from "./SlopeChartConstants"

@observer
export class SlopeChart
    extends React.Component<{
        bounds?: Bounds
        manager: ChartManager
    }>
    implements ChartInterface, VerticalColorLegendManager, ColorScaleManager {
    // currently hovered individual series key
    @observable hoverKey?: string
    // currently hovered legend color
    @observable hoverColor?: string

    @computed get manager() {
        return this.props.manager
    }

    @computed.struct get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get fontSize() {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed get colorBins() {
        return this.colorScale.legendBins.filter((bin) =>
            this.colorsInUse.includes(bin.color)
        )
    }

    @computed get maxLegendWidth() {
        return this.sidebarMaxWidth
    }

    @action.bound onSlopeMouseOver(slopeProps: SlopeProps) {
        this.hoverKey = slopeProps.entityName
    }

    @action.bound onSlopeMouseLeave() {
        this.hoverKey = undefined
    }

    @action.bound onSlopeClick() {
        const { manager, hoverKey } = this
        if (
            manager.addCountryMode === EntitySelectionModes.Disabled ||
            !manager.addCountryMode ||
            hoverKey === undefined
        ) {
            return
        }

        this.manager.table.toggleSelection(hoverKey)
    }

    @action.bound onLegendMouseOver(color: string) {
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.hoverColor = undefined
    }

    @computed private get selectedKeys() {
        return this.manager.table.selectedEntityNames
    }

    // When the color legend is clicked, toggle selection fo all associated keys
    @action.bound onLegendClick() {
        const { manager, hoverColor } = this
        if (
            manager.addCountryMode === EntitySelectionModes.Disabled ||
            !manager.addCountryMode ||
            hoverColor === undefined
        )
            return

        const keysToToggle = this.marks
            .filter((g) => g.color === hoverColor)
            .map((g) => g.entityName)
        const allKeysActive =
            intersection(keysToToggle, this.selectedKeys).length ===
            keysToToggle.length
        if (allKeysActive)
            this.manager.table.setSelectedEntities(
                without(this.selectedKeys, ...keysToToggle)
            )
        else
            this.manager.table.setSelectedEntities(
                this.selectedKeys.concat(keysToToggle)
            )
    }

    // Colors on the legend for which every matching group is focused
    @computed get focusColors() {
        const { colorsInUse } = this
        return colorsInUse.filter((color) => {
            const matchingKeys = this.marks
                .filter((g) => g.color === color)
                .map((g) => g.entityName)
            return (
                intersection(matchingKeys, this.selectedKeys).length ===
                matchingKeys.length
            )
        })
    }

    @computed get focusKeys() {
        return this.selectedKeys
    }

    // All currently hovered group keys, combining the legend and the main UI
    @computed.struct get hoverKeys() {
        const { hoverColor, hoverKey } = this

        const hoverKeys =
            hoverColor === undefined
                ? []
                : uniq(
                      this.marks
                          .filter((g) => g.color === hoverColor)
                          .map((g) => g.entityName)
                  )

        if (hoverKey !== undefined) hoverKeys.push(hoverKey)

        return hoverKeys
    }

    // Colors currently on the chart and not greyed out
    @computed get activeColors(): string[] {
        const { hoverKeys, focusKeys } = this
        const activeKeys = hoverKeys.concat(focusKeys)

        if (activeKeys.length === 0)
            // No hover or focus means they're all active by default
            return uniq(this.marks.map((g) => g.color))

        return uniq(
            this.marks
                .filter((g) => activeKeys.indexOf(g.entityName) !== -1)
                .map((g) => g.color)
        )
    }

    // Only show colors on legend that are actually in use
    @computed get colorsInUse() {
        return uniq(this.marks.map((g) => g.color))
    }

    @computed get sidebarMaxWidth() {
        return this.bounds.width * 0.5
    }

    @computed get sidebarMinWidth() {
        return 100
    }

    @computed private get legendWidth() {
        return new VerticalColorLegend({ manager: this }).width
    }

    @computed.struct get sidebarWidth() {
        const { sidebarMinWidth, sidebarMaxWidth, legendWidth } = this
        return Math.max(Math.min(legendWidth, sidebarMaxWidth), sidebarMinWidth)
    }

    // correction is to account for the space taken by the legend
    @computed get innerBounds() {
        const { sidebarWidth, showLegend } = this

        return showLegend
            ? this.bounds.padRight(sidebarWidth + 20)
            : this.bounds
    }

    // verify the validity of data used to show legend
    // this is for backwards compatibility with charts that were added without legend
    // eg: https://ourworldindata.org/grapher/mortality-rate-improvement-by-cohort
    @computed get showLegend() {
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
        const { marks, focusKeys, hoverKeys, innerBounds, showLegend } = this

        const legend = showLegend ? (
            <VerticalColorLegend manager={this} />
        ) : (
            <div></div>
        )

        return (
            <g>
                <LabelledSlopes
                    manager={manager}
                    bounds={innerBounds}
                    yColumn={this.yColumn!}
                    data={marks}
                    focusKeys={focusKeys}
                    hoverKeys={hoverKeys}
                    onMouseOver={this.onSlopeMouseOver}
                    onMouseLeave={this.onSlopeMouseLeave}
                    onClick={this.onSlopeClick}
                />
                {legend}
            </g>
        )
    }

    @computed get legendY() {
        return this.bounds.top
    }

    @computed get legendX(): number {
        return this.bounds.right - this.sidebarWidth
    }

    @computed get failMessage() {
        if (!this.yColumn) return "Missing Y column"
        else if (isEmpty(this.marks)) return "No matching data"
        return ""
    }

    @computed get colorScale() {
        return new ColorScale(this)
    }

    @computed get colorScaleConfig() {
        return {} as any // grapher.colorScale
    }

    @computed get colorScaleColumn() {
        return this.colorColumn
    }

    defaultBaseColorScheme = "continents"
    hasNoDataBin = false

    @computed get categoricalValues() {
        return this.colorColumn?.sortedUniqNonEmptyStringVals ?? []
    }

    @computed get availableTimes(): Time[] {
        return this.yColumn?.timesUniq || []
    }

    @computed private get yColumn() {
        return this.table.get(
            this.manager.yColumnSlug ?? this.manager.yColumnSlugs![0]
        )
    }

    @computed private get colorColumn() {
        return this.table.get(this.manager.colorColumnSlug)
    }

    @computed get table() {
        return this.manager.table
    }

    // helper method to directly get the associated color value given an Entity
    // dimension data saves color a level deeper. eg: { Afghanistan => { 2015: Asia|Color }}
    // this returns that data in the form { Afghanistan => Asia }
    @computed private get colorByEntity(): Map<string, string | undefined> {
        const { colorScale, colorColumn } = this
        const colorByEntity = new Map<string, string | undefined>()

        if (colorColumn)
            colorColumn.valueByEntityNameAndTime.forEach(
                (timeToColorMap, entity) => {
                    const values = Array.from(timeToColorMap.values())
                    const key = last(values)
                    colorByEntity.set(entity, colorScale.getColor(key))
                }
            )

        return colorByEntity
    }

    @computed private get sizeColumn() {
        return this.table.get(this.manager.sizeColumnSlug)
    }

    // helper method to directly get the associated size value given an Entity
    // dimension data saves size a level deeper. eg: { Afghanistan => { 1990: 1, 2015: 10 }}
    // this returns that data in the form { Afghanistan => 1 }
    @computed private get sizeByEntity(): Map<string, any> {
        const sizeCol = this.sizeColumn
        const sizeByEntity = new Map<string, any>()

        if (sizeCol)
            sizeCol.valueByEntityNameAndTime.forEach(
                (timeToSizeMap, entity) => {
                    const values = Array.from(timeToSizeMap.values())
                    sizeByEntity.set(entity, values[0]) // hack: default to the value associated with the first time
                }
            )

        return sizeByEntity
    }

    @computed get marks() {
        const column = this.yColumn
        if (!column) return []

        const { colorByEntity, sizeByEntity } = this
        const { minTime, maxTime } = column

        const table = this.manager.table

        return column.entityNamesUniqArr
            .map((entityName) => {
                const values: SlopeChartValue[] = []

                const yValues =
                    column.valueByEntityNameAndTime.get(entityName)! || []

                yValues.forEach((value, time) => {
                    if (time !== minTime && time !== maxTime) return

                    values.push({
                        x: time,
                        y: typeof value === "string" ? parseInt(value) : value,
                    })
                })

                return {
                    entityName,
                    label: entityName,
                    color:
                        table.getColorForEntityName(entityName) ||
                        colorByEntity.get(entityName) ||
                        "#ff7f0e",
                    size: sizeByEntity.get(entityName) || 1,
                    values,
                } as SlopeChartSeries
            })
            .filter((d) => d.values.length >= 2)
    }
}

@observer
class SlopeChartAxis extends React.Component<SlopeAxisProps> {
    static calculateBounds(
        containerBounds: Bounds,
        props: {
            tickFormat: (value: number) => string
            orient: "left" | "right"
            scale: ScaleLinear<number, number>
        }
    ) {
        const { scale } = props
        const longestTick = maxBy(
            scale.ticks(6).map(props.tickFormat),
            (tick) => tick.length
        )
        const axisWidth = Bounds.forText(longestTick).width
        return new Bounds(
            containerBounds.x,
            containerBounds.y,
            axisWidth,
            containerBounds.height
        )
    }

    static getTicks(
        scale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>,
        scaleType: ScaleType
    ) {
        if (scaleType === ScaleType.log) {
            let minPower10 = Math.ceil(
                Math.log(scale.domain()[0]) / Math.log(10)
            )
            if (!isFinite(minPower10)) minPower10 = 0
            let maxPower10 = Math.floor(
                Math.log(scale.domain()[1]) / Math.log(10)
            )
            if (maxPower10 <= minPower10) maxPower10 += 1

            const tickValues = []
            for (let i = minPower10; i <= maxPower10; i++) {
                tickValues.push(Math.pow(10, i))
            }
            return tickValues
        } else {
            return scale.ticks(6)
        }
    }

    @computed get ticks() {
        return SlopeChartAxis.getTicks(this.props.scale, this.props.scaleType)
    }

    render() {
        const { bounds, scale, orient, tickFormat } = this.props
        const { ticks } = this
        const textColor = "#666"

        return (
            <g className="axis" fontSize="0.8em">
                {ticks.map((tick, i) => {
                    return (
                        <text
                            key={i}
                            x={orient === "left" ? bounds.left : bounds.right}
                            y={scale(tick)}
                            fill={textColor}
                            dominantBaseline="middle"
                            textAnchor={orient === "left" ? "start" : "end"}
                        >
                            {tickFormat(tick)}
                        </text>
                    )
                })}
            </g>
        )
    }
}

@observer
class Slope extends React.Component<SlopeProps> {
    line: SVGElement

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
            leftValueStr,
            rightValueStr,
            leftLabel,
            rightLabel,
            labelFontSize,
            leftLabelBounds,
            rightLabelBounds,
            isFocused,
            isHovered,
        } = this.props
        const { isInBackground } = this

        const lineColor = isInBackground ? "#e2e2e2" : color //'#89C9CF'
        const labelColor = isInBackground ? "#aaa" : "#333"
        const opacity = isHovered ? 1 : isFocused ? 0.7 : 0.5
        const lineStrokeWidth = isHovered
            ? size * 2
            : isFocused
            ? 1.5 * size
            : size

        const leftValueLabelBounds = Bounds.forText(leftValueStr, {
            fontSize: labelFontSize,
        })
        const rightValueLabelBounds = Bounds.forText(rightValueStr, {
            fontSize: labelFontSize,
        })

        return (
            <g className="slope">
                {hasLeftLabel &&
                    leftLabel.render(
                        leftLabelBounds.x + leftLabelBounds.width,
                        leftLabelBounds.y,
                        {
                            textAnchor: "end",
                            fill: labelColor,
                            fontWeight:
                                isFocused || isHovered ? "bold" : undefined,
                        }
                    )}
                {hasLeftLabel && (
                    <Text
                        x={x1 - 8}
                        y={y1 - leftValueLabelBounds.height / 2}
                        textAnchor="end"
                        fontSize={labelFontSize}
                        fill={labelColor}
                        fontWeight={isFocused || isHovered ? "bold" : undefined}
                    >
                        {leftValueStr}
                    </Text>
                )}
                <circle
                    cx={x1}
                    cy={y1}
                    r={isFocused || isHovered ? 4 : 2}
                    fill={lineColor}
                    opacity={opacity}
                />
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
                <circle
                    cx={x2}
                    cy={y2}
                    r={isFocused || isHovered ? 4 : 2}
                    fill={lineColor}
                    opacity={opacity}
                />
                {hasRightLabel && (
                    <Text
                        x={x2 + 8}
                        y={y2 - rightValueLabelBounds.height / 2}
                        fontSize={labelFontSize}
                        fill={labelColor}
                        fontWeight={isFocused || isHovered ? "bold" : undefined}
                    >
                        {rightValueStr}
                    </Text>
                )}
                {hasRightLabel &&
                    rightLabel.render(rightLabelBounds.x, rightLabelBounds.y, {
                        fill: labelColor,
                        fontWeight: isFocused || isHovered ? "bold" : undefined,
                    })}
            </g>
        )
    }
}

@observer
class LabelledSlopes extends React.Component<LabelledSlopesProps> {
    base: React.RefObject<SVGGElement> = React.createRef()
    svg: SVGElement

    @computed get data() {
        return this.props.data
    }

    @computed get yColumn() {
        return this.props.yColumn
    }

    @computed get manager() {
        return this.props.manager
    }

    @computed get bounds() {
        return this.props.bounds
    }

    @computed get focusKeys() {
        return intersection(
            this.props.focusKeys || [],
            this.data.map((g) => g.entityName)
        )
    }

    @computed get hoverKeys() {
        return intersection(
            this.props.hoverKeys || [],
            this.data.map((g) => g.entityName)
        )
    }

    // Layered mode occurs when any entity on the chart is hovered or focused
    // Then, a special "foreground" set of entities is rendered over the background
    @computed get isLayerMode() {
        return this.focusKeys.length > 0 || this.hoverKeys.length > 0
    }

    @computed get isPortrait() {
        return this.bounds.width < 400
    }

    @computed get allValues() {
        return flatten(this.props.data.map((g) => g.values))
    }

    @computed get xDomainDefault(): [number, number] {
        return domainExtent(
            this.allValues.map((v) => v.x),
            ScaleType.linear
        )
    }

    @computed private get yScaleType() {
        return this.manager.yAxis?.scaleType || ScaleType.linear
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
        const domain = this.manager.yAxis?.domain || [Infinity, -Infinity]
        const domainDefault = this.yDomainDefault
        return [
            Math.min(domain[0], domainDefault[0]),
            Math.max(domain[1], domainDefault[1]),
        ]
    }

    @computed get sizeScale(): ScaleLinear<number, number> {
        return scaleLinear()
            .domain(
                extent(this.props.data.map((d) => d.size)) as [number, number]
            )
            .range([1, 4])
    }

    @computed get yScaleConstructor(): any {
        return this.yScaleType === ScaleType.log ? scaleLog : scaleLinear
    }

    @computed private get yScale():
        | ScaleLinear<number, number>
        | ScaleLogarithmic<number, number> {
        return this.yScaleConstructor()
            .domain(this.yDomain)
            .range(this.props.bounds.padBottom(50).yRange())
    }

    @computed private get xScale(): ScaleLinear<number, number> {
        const { bounds, isPortrait, xDomain, yScale } = this
        const padding = isPortrait
            ? 0
            : SlopeChartAxis.calculateBounds(bounds, {
                  orient: "left",
                  scale: yScale,
                  tickFormat: this.formatValueFn,
              }).width
        return scaleLinear()
            .domain(xDomain)
            .range(bounds.padWidth(padding).xRange())
    }

    @computed get maxLabelWidth() {
        return this.bounds.width / 5
    }

    @computed private get initialSlopeData() {
        const {
            data,
            isPortrait,
            xScale,
            yScale,
            sizeScale,
            maxLabelWidth: maxWidth,
        } = this

        const slopeData: SlopeProps[] = []
        const yDomain = yScale.domain()

        data.forEach((series) => {
            // Ensure values fit inside the chart
            if (
                !series.values.every(
                    (d) => d.y >= yDomain[0] && d.y <= yDomain[1]
                )
            )
                return

            const text = series.label
            const [v1, v2] = series.values
            const [x1, x2] = [xScale(v1.x), xScale(v2.x)]
            const [y1, y2] = [yScale(v1.y), yScale(v2.y)]
            const fontSize =
                (isPortrait ? 0.6 : 0.65) *
                (this.manager.baseFontSize ?? BASE_FONT_SIZE)
            const leftValueStr = this.formatValueFn(v1.y)
            const rightValueStr = this.formatValueFn(v2.y)
            const leftValueWidth = Bounds.forText(leftValueStr, {
                fontSize,
            }).width
            const rightValueWidth = Bounds.forText(rightValueStr, {
                fontSize,
            }).width
            const leftLabel = new TextWrap({
                maxWidth,
                fontSize,
                text,
            })
            const rightLabel = new TextWrap({
                maxWidth,
                fontSize,
                text,
            })

            slopeData.push({
                x1,
                y1,
                x2,
                y2,
                color: series.color,
                size: sizeScale(series.size) || 1,
                leftValueStr,
                rightValueStr,
                leftValueWidth,
                rightValueWidth,
                leftLabel,
                rightLabel,
                labelFontSize: fontSize,
                entityName: series.entityName,
                isFocused: false,
                isHovered: false,
                hasLeftLabel: true,
                hasRightLabel: true,
            } as SlopeProps)
        })

        return slopeData
    }

    @computed get maxValueWidth() {
        return max(this.initialSlopeData.map((s) => s.leftValueWidth)) as number
    }

    @computed private get labelAccountedSlopeData() {
        const { maxLabelWidth, maxValueWidth } = this

        return this.initialSlopeData.map((slope) => {
            // Squish slopes to make room for labels
            const x1 = slope.x1 + maxLabelWidth + maxValueWidth + 8
            const x2 = slope.x2 - maxLabelWidth - maxValueWidth - 8

            // Position the labels
            const leftLabelBounds = new Bounds(
                x1 - slope.leftValueWidth - 12 - slope.leftLabel.width,
                slope.y1 - slope.leftLabel.height / 2,
                slope.leftLabel.width,
                slope.leftLabel.height
            )
            const rightLabelBounds = new Bounds(
                x2 + slope.rightValueWidth + 12,
                slope.y2 - slope.rightLabel.height / 2,
                slope.rightLabel.width,
                slope.rightLabel.height
            )

            return {
                ...slope,
                x1: x1,
                x2: x2,
                leftLabelBounds: leftLabelBounds,
                rightLabelBounds: rightLabelBounds,
            }
        })
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
        const { focusKeys, hoverKeys } = this
        let slopeData = this.labelAccountedSlopeData

        slopeData = slopeData.map((slope) => {
            return {
                ...slope,
                isFocused: focusKeys.includes(slope.entityName),
                isHovered: hoverKeys.includes(slope.entityName),
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
                    s1.leftLabelBounds.intersects(s2.leftLabelBounds)
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
                    s1.rightLabelBounds.intersects(s2.rightLabelBounds)
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
        const mouse = getRelativeMouse(this.base.current, ev.nativeEvent)

        this.mouseFrame = requestAnimationFrame(() => {
            if (this.props.bounds.contains(mouse)) {
                const distToSlope = new Map<SlopeProps, number>()
                for (const s of this.slopeData) {
                    const dist =
                        Math.abs(
                            (s.y2 - s.y1) * mouse.x -
                                (s.x2 - s.x1) * mouse.y +
                                s.x2 * s.y1 -
                                s.y2 * s.x1
                        ) / Math.sqrt((s.y2 - s.y1) ** 2 + (s.x2 - s.x1) ** 2)
                    distToSlope.set(s, dist)
                }

                const closestSlope = minBy(this.slopeData, (s) =>
                    distToSlope.get(s)
                )

                if (
                    closestSlope &&
                    (distToSlope.get(closestSlope) as number) < 20 &&
                    this.props.onMouseOver
                ) {
                    this.props.onMouseOver(closestSlope)
                } else {
                    this.props.onMouseLeave()
                }
            }
        })
    }

    @action.bound onClick() {
        if (this.props.onClick) this.props.onClick()
    }

    componentDidMount() {
        // Nice little intro animation
        select(this.base.current)
            .select(".slopes")
            .attr("stroke-dasharray", "100%")
            .attr("stroke-dashoffset", "100%")
            .transition()
            .attr("stroke-dashoffset", "0%")
    }

    renderGroups(groups: SlopeProps[]) {
        const { isLayerMode } = this

        return groups.map((slope) => (
            <Slope
                key={slope.entityName}
                {...slope}
                isLayerMode={isLayerMode}
            />
        ))
    }

    @computed get controls() {
        const { yAxis } = this.manager
        const showScaleSelector =
            this.manager.isInteractive && yAxis?.canChangeScaleType
        if (!showScaleSelector) return undefined
        return (
            <foreignObject id="slope-scale-selector" paddingTop={20}>
                <ScaleSelector
                    x={this.bounds.x}
                    y={this.bounds.y - 35}
                    scaleTypeConfig={yAxis!.toVerticalAxis()}
                />
            </foreignObject>
        )
    }

    @computed get formatValueFn() {
        return (val: any) => this.yColumn.formatValueShort(val)
    }

    render() {
        const yTickFormat = this.formatValueFn
        const baseFontSize = this.manager.baseFontSize ?? BASE_FONT_SIZE
        const yScaleType = this.yScaleType
        const {
            bounds,
            slopeData,
            isPortrait,
            xDomain,
            yScale,
            onMouseMove,
        } = this

        if (isEmpty(slopeData))
            return <NoDataModal manager={this.props.manager} bounds={bounds} />

        const { x1, x2 } = slopeData[0]
        const [y1, y2] = yScale.range()

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
                    {SlopeChartAxis.getTicks(yScale, yScaleType).map(
                        (tick, i) => {
                            return (
                                <line
                                    key={i}
                                    x1={x1}
                                    y1={yScale(tick)}
                                    x2={x2}
                                    y2={yScale(tick)}
                                    stroke="#eee"
                                    strokeDasharray="3,2"
                                />
                            )
                        }
                    )}
                </g>
                {!isPortrait && (
                    <SlopeChartAxis
                        orient="left"
                        tickFormat={yTickFormat}
                        scale={yScale}
                        scaleType={yScaleType}
                        bounds={bounds}
                    />
                )}
                {!isPortrait && (
                    <SlopeChartAxis
                        orient="right"
                        tickFormat={yTickFormat}
                        scale={yScale}
                        scaleType={yScaleType}
                        bounds={bounds}
                    />
                )}
                <line x1={x1} y1={y1} x2={x1} y2={y2} stroke="#333" />
                <line x1={x2} y1={y1} x2={x2} y2={y2} stroke="#333" />
                {this.controls}
                <Text
                    x={x1}
                    y={y1 + 10}
                    textAnchor="middle"
                    fill="#666"
                    fontSize={baseFontSize}
                >
                    {xDomain[0].toString()}
                </Text>
                <Text
                    x={x2}
                    y={y1 + 10}
                    textAnchor="middle"
                    fill="#666"
                    fontSize={baseFontSize}
                >
                    {xDomain[1].toString()}
                </Text>
                <g className="slopes">
                    {this.renderGroups(this.backgroundGroups)}
                    {this.renderGroups(this.foregroundGroups)}
                </g>
            </g>
        )
    }
}
