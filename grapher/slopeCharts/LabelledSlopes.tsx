import * as React from "react"
import { scaleLinear, scaleLog, ScaleLinear, ScaleLogarithmic } from "d3-scale"
import { extent } from "d3-array"
import { select } from "d3-selection"
import {
    sortBy,
    max,
    isEmpty,
    intersection,
    flatten,
    SVGElement,
    getRelativeMouse,
    domainExtent,
    minBy,
    maxBy,
} from "grapher/utils/Util"
import { computed, action } from "mobx"
import { observer } from "mobx-react"

import { BASE_FONT_SIZE, ScaleType } from "grapher/core/GrapherConstants"
import { Bounds } from "grapher/utils/Bounds"
import { Text } from "grapher/text/Text"
import { TextWrap } from "grapher/text/TextWrap"
import { NoDataOverlay } from "grapher/chart/NoDataOverlay"
import { ScaleSelector } from "grapher/controls/ScaleSelector"
import { ControlsOverlay } from "grapher/controls/ControlsOverlay"
import { EntityName } from "coreTable/CoreTableConstants"
import { AbstractCoreColumn } from "coreTable/CoreTable"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"

export interface SlopeChartValue {
    x: number
    y: number
}

export interface SlopeChartSeries {
    label: string
    entityName: EntityName
    color: string
    size: number
    values: SlopeChartValue[]
}

interface AxisProps {
    bounds: Bounds
    orient: "left" | "right"
    tickFormat: (value: number) => string
    scale: any
    scaleType: ScaleType
}

@observer
class SlopeChartAxis extends React.Component<AxisProps> {
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

export interface SlopeProps {
    entityName: EntityName
    isLayerMode: boolean
    x1: number
    y1: number
    x2: number
    y2: number
    color: string
    size: number
    hasLeftLabel: boolean
    hasRightLabel: boolean
    labelFontSize: number
    leftLabelBounds: Bounds
    rightLabelBounds: Bounds
    leftValueStr: string
    rightValueStr: string
    leftLabel: TextWrap
    rightLabel: TextWrap
    isFocused: boolean
    isHovered: boolean
    leftValueWidth: number
    rightValueWidth: number
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

interface LabelledSlopesProps {
    options: ChartOptionsProvider
    yColumn: AbstractCoreColumn
    bounds: Bounds
    data: SlopeChartSeries[]
    focusKeys: string[]
    hoverKeys: string[]
    onMouseOver: (slopeProps: SlopeProps) => void
    onMouseLeave: () => void
    onClick: () => void
}

@observer
export class LabelledSlopes extends React.Component<LabelledSlopesProps> {
    base: React.RefObject<SVGGElement> = React.createRef()
    svg: SVGElement

    @computed get data() {
        return this.props.data
    }

    @computed get yColumn() {
        return this.props.yColumn
    }

    @computed get options() {
        return this.props.options
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
        return this.options.yAxis?.scaleType || ScaleType.linear
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
        const domain = this.options.yAxis?.domain || [Infinity, -Infinity]
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
                (this.options.baseFontSize ?? BASE_FONT_SIZE)
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
        const { yAxis } = this.options
        const showScaleSelector =
            this.options.isInteractive && yAxis?.canChangeScaleType
        if (!showScaleSelector) return undefined
        return (
            <ControlsOverlay id="slope-scale-selector" paddingTop={20}>
                <ScaleSelector
                    x={this.bounds.x}
                    y={this.bounds.y - 35}
                    scaleTypeConfig={yAxis!.toVerticalAxis()}
                />
            </ControlsOverlay>
        )
    }

    @computed get formatValueFn() {
        return (val: any) => this.yColumn.formatValueShort(val)
    }

    render() {
        const yTickFormat = this.formatValueFn
        const baseFontSize = this.options.baseFontSize ?? BASE_FONT_SIZE
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
            return (
                <NoDataOverlay options={this.props.options} bounds={bounds} />
            )

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
