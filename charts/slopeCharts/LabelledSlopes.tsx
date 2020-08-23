/* LabelledSlopes.jsx
 * ================
 *
 * Decoupled view component that does the bulk rendering work for slope charts.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-02-11
 */

import * as React from "react"
import { scaleLinear, scaleLog, ScaleLinear, ScaleLogarithmic } from "d3-scale"
import { extent } from "d3-array"
import { select } from "d3-selection"
import {
    every,
    first,
    sortBy,
    extend,
    max,
    isEmpty,
    intersection,
    includes,
    filter,
    flatten,
    SVGElement,
    getRelativeMouse,
    domainExtent
} from "../utils/Util"
import { computed, action } from "mobx"
import { observer } from "mobx-react"

import { ScaleType } from "charts/core/ChartConstants"
import { Bounds } from "charts/utils/Bounds"
import { Text } from "charts/text/Text"
import { TextWrap } from "charts/text/TextWrap"
import { NoDataOverlay } from "charts/core/NoDataOverlay"
import { ScaleSelector } from "charts/controls/ScaleSelector"
import { EntityDimensionKey } from "charts/core/ChartConstants"
import { ControlsOverlay } from "charts/controls/Controls"

export interface SlopeChartValue {
    x: number
    y: number
}

export interface SlopeChartSeries {
    label: string
    entityDimensionKey: EntityDimensionKey
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
        const longestTick = first(
            sortBy(scale.ticks(6).map(props.tickFormat), tick => -tick.length)
        ) as string
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
        if (scaleType === "log") {
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
    entityDimensionKey: EntityDimensionKey
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

    @computed get isInBackground(): boolean {
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
            isHovered
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
            fontSize: labelFontSize
        })
        const rightValueLabelBounds = Bounds.forText(rightValueStr, {
            fontSize: labelFontSize
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
                                isFocused || isHovered ? "bold" : undefined
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
                    ref={el => (this.line = el)}
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
                        fontWeight: isFocused || isHovered ? "bold" : undefined
                    })}
            </g>
        )
    }
}

export interface LabelledSlopesProps {
    bounds: Bounds
    data: SlopeChartSeries[]
    yDomain: [number | undefined, number | undefined]
    yTickFormat: (value: number) => string
    yScaleType: ScaleType
    yScaleTypeOptions: ScaleType[]
    onScaleTypeChange: (scaleType: ScaleType) => void
    fontSize: number
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

    @computed get data(): SlopeChartSeries[] {
        return this.props.data
    }

    @computed get yTickFormat(): (value: number) => string {
        return this.props.yTickFormat
    }

    @computed get bounds(): Bounds {
        return this.props.bounds
    }

    @computed get focusKeys(): string[] {
        return intersection(
            this.props.focusKeys || [],
            this.data.map(g => g.entityDimensionKey)
        )
    }

    @computed get hoverKeys(): string[] {
        return intersection(
            this.props.hoverKeys || [],
            this.data.map(g => g.entityDimensionKey)
        )
    }

    // Layered mode occurs when any entity on the chart is hovered or focused
    // Then, a special "foreground" set of entities is rendered over the background
    @computed get isLayerMode() {
        return this.focusKeys.length > 0 || this.hoverKeys.length > 0
    }

    @computed get isPortrait(): boolean {
        return this.bounds.width < 400
    }

    @computed get allValues(): SlopeChartValue[] {
        return flatten(this.props.data.map(g => g.values))
    }

    @computed get xDomainDefault(): [number, number] {
        return domainExtent(
            this.allValues.map(v => v.x),
            "linear"
        )
    }

    @computed get yDomainDefault(): [number, number] {
        return domainExtent(
            this.allValues.map(v => v.y),
            this.props.yScaleType
        )
    }

    @computed get xDomain(): [number, number] {
        return this.xDomainDefault
    }

    @computed get yDomain(): [number, number] {
        return [
            this.props.yDomain[0] === undefined
                ? this.yDomainDefault[0]
                : this.props.yDomain[0],
            this.props.yDomain[1] === undefined
                ? this.yDomainDefault[1]
                : this.props.yDomain[1]
        ] as [number, number]
    }

    @computed get sizeScale(): ScaleLinear<number, number> {
        return scaleLinear()
            .domain(
                extent(this.props.data.map(d => d.size)) as [number, number]
            )
            .range([1, 4])
    }

    @computed get yScaleConstructor(): any {
        return this.props.yScaleType === "log" ? scaleLog : scaleLinear
    }

    @computed get yScale():
        | ScaleLinear<number, number>
        | ScaleLogarithmic<number, number> {
        return this.yScaleConstructor()
            .domain(this.yDomain)
            .range(this.props.bounds.padBottom(50).yRange())
    }

    @computed get xScale(): ScaleLinear<number, number> {
        const { bounds, isPortrait, xDomain, yScale } = this
        const padding = isPortrait
            ? 0
            : SlopeChartAxis.calculateBounds(bounds, {
                  orient: "left",
                  scale: yScale,
                  tickFormat: this.props.yTickFormat
              }).width
        return scaleLinear()
            .domain(xDomain)
            .range(bounds.padWidth(padding).xRange())
    }

    @computed get maxLabelWidth(): number {
        return this.bounds.width / 5
    }

    @computed get initialSlopeData(): SlopeProps[] {
        const {
            data,
            isPortrait,
            xScale,
            yScale,
            sizeScale,
            yTickFormat,
            maxLabelWidth
        } = this

        const slopeData: SlopeProps[] = []
        const yDomain = yScale.domain()

        data.forEach(series => {
            // Ensure values fit inside the chart
            if (
                !every(
                    series.values,
                    d => d.y >= yDomain[0] && d.y <= yDomain[1]
                )
            )
                return

            const [v1, v2] = series.values
            const [x1, x2] = [xScale(v1.x), xScale(v2.x)]
            const [y1, y2] = [yScale(v1.y), yScale(v2.y)]
            const fontSize = (isPortrait ? 0.6 : 0.65) * this.props.fontSize
            const leftValueStr = yTickFormat(v1.y)
            const rightValueStr = yTickFormat(v2.y)
            const leftValueWidth = Bounds.forText(leftValueStr, {
                fontSize: fontSize
            }).width
            const rightValueWidth = Bounds.forText(rightValueStr, {
                fontSize: fontSize
            }).width
            const leftLabel = new TextWrap({
                maxWidth: maxLabelWidth,
                fontSize: fontSize,
                text: series.label
            })
            const rightLabel = new TextWrap({
                maxWidth: maxLabelWidth,
                fontSize: fontSize,
                text: series.label
            })

            slopeData.push({
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2,
                color: series.color,
                size: sizeScale(series.size) || 1,
                leftValueStr,
                rightValueStr,
                leftValueWidth,
                rightValueWidth,
                leftLabel,
                rightLabel,
                labelFontSize: fontSize,
                entityDimensionKey: series.entityDimensionKey,
                isFocused: false,
                isHovered: false,
                hasLeftLabel: true,
                hasRightLabel: true
            } as SlopeProps)
        })

        return slopeData
    }

    @computed get maxValueWidth(): number {
        return max(this.initialSlopeData.map(s => s.leftValueWidth)) as number
    }

    @computed get labelAccountedSlopeData() {
        const { maxLabelWidth, maxValueWidth } = this

        return this.initialSlopeData.map(slope => {
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

            return extend({}, slope, {
                x1: x1,
                x2: x2,
                leftLabelBounds: leftLabelBounds,
                rightLabelBounds: rightLabelBounds
            })
        })
    }

    @computed get backgroundGroups(): SlopeProps[] {
        return filter(
            this.slopeData,
            group => !(group.isHovered || group.isFocused)
        )
    }

    @computed get foregroundGroups(): SlopeProps[] {
        return filter(
            this.slopeData,
            group => !!(group.isHovered || group.isFocused)
        )
    }

    // Get the final slope data with hover focusing and collision detection
    @computed get slopeData(): SlopeProps[] {
        const { focusKeys, hoverKeys } = this
        let slopeData = this.labelAccountedSlopeData

        slopeData = slopeData.map(slope => {
            return extend({}, slope, {
                isFocused: includes(focusKeys, slope.entityDimensionKey),
                isHovered: includes(hoverKeys, slope.entityDimensionKey)
            })
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
        slopeData.forEach(s1 => {
            slopeData.forEach(s2 => {
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

        slopeData.forEach(s1 => {
            slopeData.forEach(s2 => {
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
        slopeData = sortBy(slopeData, slope => slope.size)
        slopeData = sortBy(slopeData, slope =>
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

                const closestSlope = sortBy(this.slopeData, s =>
                    distToSlope.get(s)
                )[0]

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

    renderBackgroundGroups() {
        const { backgroundGroups, isLayerMode } = this

        return backgroundGroups.map(slope => (
            <Slope
                key={slope.entityDimensionKey}
                isLayerMode={isLayerMode}
                {...slope}
            />
        ))
    }

    renderForegroundGroups() {
        const { foregroundGroups, isLayerMode } = this

        return foregroundGroups.map(slope => (
            <Slope
                key={slope.entityDimensionKey}
                isLayerMode={isLayerMode}
                {...slope}
            />
        ))
    }

    render() {
        const {
            yTickFormat,
            yScaleType,
            yScaleTypeOptions,
            onScaleTypeChange,
            fontSize
        } = this.props
        const {
            bounds,
            slopeData,
            isPortrait,
            xDomain,
            yScale,
            onMouseMove
        } = this

        if (isEmpty(slopeData)) return <NoDataOverlay bounds={bounds} />

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
                {yScaleTypeOptions.length > 1 && (
                    <ControlsOverlay id="slope-scale-selector" paddingTop={20}>
                        <ScaleSelector
                            x={bounds.x}
                            y={bounds.y - 35}
                            scaleType={yScaleType}
                            scaleTypeOptions={yScaleTypeOptions}
                            onChange={onScaleTypeChange}
                        />
                    </ControlsOverlay>
                )}
                <Text
                    x={x1}
                    y={y1 + 10}
                    textAnchor="middle"
                    fill="#666"
                    fontSize={fontSize}
                >
                    {xDomain[0].toString()}
                </Text>
                <Text
                    x={x2}
                    y={y1 + 10}
                    textAnchor="middle"
                    fill="#666"
                    fontSize={fontSize}
                >
                    {xDomain[1].toString()}
                </Text>
                <g className="slopes">
                    {this.renderBackgroundGroups()}
                    {this.renderForegroundGroups()}
                </g>
            </g>
        )
    }
}
