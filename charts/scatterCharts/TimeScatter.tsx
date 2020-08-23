// Note: There may be only 1 chart using this, and we should probably look into deleting this class and file.

import * as React from "react"
import { observable, computed, action, runInAction } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "charts/utils/Bounds"
import { ChartConfig } from "charts/core/ChartConfig"
import { NoDataOverlay } from "../core/NoDataOverlay"
import { AxisBox, AxisBoxView } from "charts/axis/AxisBox"
import { ComparisonLine } from "./ComparisonLine"
import { AxisScale } from "charts/axis/AxisScale"
import { ScaleType } from "charts/core/ChartConstants"

import {
    sortBy,
    cloneDeep,
    isEmpty,
    guid,
    getRelativeMouse,
    makeSafeForCSS
} from "../utils/Util"
import { Vector2 } from "charts/utils/Vector2"
import { select } from "d3-selection"
import { Tooltip } from "charts/core/Tooltip"
import { TimeBound } from "../utils/TimeBounds"
import { EntityDimensionKey } from "charts/core/ChartConstants"

interface ScatterSeries {
    color: string
    entityDimensionKey: EntityDimensionKey
    label: string
    size: number
    values: ScatterValue[]
    isScaleColor?: true
}

interface ScatterValue {
    x: number
    y: number
    size: number
    color?: number | string
    year: number
    time: {
        x: number
        y: number
        span?: [number, number]
    }
}

interface PointsWithLabelsProps {
    data: ScatterSeries[]
    hoverKeys: string[]
    focusKeys: string[]
    bounds: Bounds
    xScale: AxisScale
    yScale: AxisScale
    sizeDomain: [number, number]
    hideLines: boolean
    chart: ChartConfig
}

interface ScatterRenderPoint {
    position: Vector2
    size: number
    fontSize: number
    value: ScatterValue
    time: {
        x: number
        y: number
    }
}

interface ScatterRenderSeries {
    entityDimensionKey: EntityDimensionKey
    displayKey: string
    color: string
    points: ScatterRenderPoint[]
    text: string
    isHover?: boolean
    isFocus?: boolean
    isForeground?: boolean
    offsetVector: Vector2
}

interface ScatterLabel {
    text: string
    fontSize: number
    bounds: Bounds
    isHidden?: boolean
}

@observer
class PointsWithLabels extends React.Component<PointsWithLabelsProps> {
    base: React.RefObject<SVGGElement> = React.createRef()
    @observable.ref mousePos?: Vector2

    @computed get isConnected(): boolean {
        return true
    }

    @computed get bounds(): Bounds {
        return this.props.bounds
    }

    @computed get xScale(): AxisScale {
        return this.props.xScale.extend({ range: this.bounds.xRange() })
    }

    @computed get yScale(): AxisScale {
        return this.props.yScale.extend({ range: this.bounds.yRange() })
    }

    @computed get labelFontFamily(): string {
        return "Arial Narrow, Arial, sans-serif"
    }

    @computed get hideLines(): boolean {
        return this.props.hideLines
    }

    @computed get transform() {
        return this.props.chart.scatter
    }

    @computed get tooltip() {
        const { hoverPoint, transform } = this
        if (hoverPoint === undefined) return

        const value = hoverPoint.value

        const formatFunction = this.props.chart.formatYearFunction

        const year = value.time.span
            ? `${formatFunction(value.time.span[0])} to ${formatFunction(
                  value.time.span[1]
              )}`
            : formatFunction(value.time.y)

        return (
            <Tooltip
                x={hoverPoint.position.x + 5}
                y={hoverPoint.position.y + 5}
                style={{ textAlign: "center" }}
            >
                <h3
                    style={{
                        padding: "0.3em 0.9em",
                        margin: 0,
                        backgroundColor: "#fcfcfc",
                        borderBottom: "1px solid #ebebeb",
                        fontWeight: "normal",
                        fontSize: "1em"
                    }}
                >
                    {year}
                </h3>
                <p
                    style={{
                        margin: 0,
                        padding: "0.3em 0.9em",
                        fontSize: "0.8em"
                    }}
                >
                    <span>
                        {transform.yAxis.label}{" "}
                        <strong>{transform.yFormatTooltip(value.y)}</strong>
                    </span>
                    <br />
                    <span>
                        {transform.xAxis.label}{" "}
                        <strong>
                            {transform.xFormatTooltip(value.x)}
                            {!value.time.span && value.time.y !== value.time.x
                                ? ` (data from ${value.time.x})`
                                : ""}
                        </strong>
                    </span>
                </p>
            </Tooltip>
        )
    }

    @computed get series(): ScatterRenderSeries {
        const { xScale, yScale } = this
        const d = cloneDeep(this.props.data[0])

        const points = d.values.map(v => {
            const area = 1
            return {
                position: new Vector2(
                    Math.floor(xScale.place(v.x)),
                    Math.floor(yScale.place(v.y))
                ),
                size: Math.sqrt(area / Math.PI),
                time: v.time,
                value: v,
                fontSize: 8
            }
        })

        return {
            entityDimensionKey: d.entityDimensionKey,
            displayKey: "key-" + makeSafeForCSS(d.entityDimensionKey),
            color: d.color,
            points: points,
            text: d.label,
            offsetVector: Vector2.zero
        }
    }

    @computed get values(): ScatterRenderPoint[] {
        return this.series.points
    }

    labelPriority(l: ScatterLabel) {
        const priority = l.fontSize

        // if (l.series.isHover)
        //     priority += 10000

        return priority
    }

    @computed get labelFontSize() {
        return 12
    }

    @computed get hoverLabelFontSize() {
        return 14
    }

    @computed get labelCandidates() {
        return this.values.map(v => {
            return {
                text: v.time.y.toString(),
                fontSize: this.labelFontSize,
                value: v,
                bounds: Bounds.forText(v.time.y.toString(), {
                    x: v.position.x + 3,
                    y: v.position.y - 3,
                    fontSize: this.labelFontSize,
                    fontFamily: this.labelFontFamily
                }),
                isHidden: false
            }
        })
    }

    // @computed get startLabel(): ScatterLabel|undefined {
    //     const { series, labelFontFamily, labelFontSize } = this
    //     if (series.values.length === 1)
    //         return undefined

    //     const firstValue = series.values[0]
    //     const nextValue = series.values[1]
    //     const nextSegment = nextValue.position.subtract(firstValue.position)

    //     const pos = firstValue.position.subtract(nextSegment.normalize().times(5))
    //     let bounds = Bounds.forText(firstValue.time.y.toString(), { x: pos.x, y: pos.y, fontSize: labelFontSize, fontFamily: labelFontFamily })
    //     if (pos.x < firstValue.position.x)
    //         bounds = new Bounds(bounds.x - bounds.width + 2, bounds.y, bounds.width, bounds.height)
    //     if (pos.y > firstValue.position.y)
    //         bounds = new Bounds(bounds.x, bounds.y + bounds.height / 2, bounds.width, bounds.height)

    //     return {
    //         text: firstValue.time.y.toString(),
    //         fontSize: labelFontSize,
    //         bounds: bounds
    //     }

    // }

    // // Make labels for the points between start and end on a series
    // // Positioned using normals of the line segmen
    // @computed get midLabels(): ScatterLabel[] {
    //     const { labelFontFamily, labelFontSize, series } = this

    //     return series.values.slice(1, -1).map((v, i) => {
    //         const prevPos = i > 0 && series.values[i - 1].position
    //         const prevSegment = prevPos && v.position.subtract(prevPos)
    //         const nextPos = series.values[i + 1].position
    //         const nextSegment = nextPos.subtract(v.position)

    //         let pos = v.position
    //         if (prevPos && prevSegment) {
    //             const normals = prevSegment.add(nextSegment).normalize().normals().map(x => x.times(5))
    //             const potentialSpots = normals.map(n => v.position.add(n))
    //             pos = sortBy(potentialSpots, p => {
    //                 return -(Vector2.distance(p, prevPos) + Vector2.distance(p, nextPos))
    //             })[0]
    //         } else {
    //             pos = v.position.subtract(nextSegment.normalize().times(5))
    //         }

    //         let bounds = Bounds.forText(v.time.y.toString(), { x: pos.x, y: pos.y, fontSize: labelFontSize, fontFamily: labelFontFamily })
    //         if (pos.x < v.position.x)
    //             bounds = new Bounds(bounds.x - bounds.width + 2, bounds.y, bounds.width, bounds.height)
    //         if (pos.y > v.position.y)
    //             bounds = new Bounds(bounds.x, bounds.y + bounds.height / 2, bounds.width, bounds.height)

    //         return {
    //             text: v.time.y.toString(),
    //             fontSize: labelFontSize,
    //             bounds: bounds,
    //             series: series
    //         }
    //     })
    // }

    // Make the end label (entity label) for a series. Will be pushed
    // slightly out based on the direction of the series if multiple values
    // are present
    // This is also the one label in the case of a single point
    // @computed get endLabel(): ScatterLabel {
    //     const { series, labelFontSize, labelFontFamily, offsetVector } = this

    //     const lastValue = last(this.allPoints) as ScatterRenderValue
    //     const lastPos = lastValue.position
    //     const labelPos = lastPos.add(offsetVector.normalize().times(series.values.length === 1 ? lastValue.size + 1 : 5))

    //     let labelBounds = Bounds.forText(series.text, { x: labelPos.x, y: labelPos.y, fontSize: labelFontSize, fontFamily: labelFontFamily })

    //     if (labelPos.x < lastPos.x)
    //         labelBounds = labelBounds.extend({ x: labelBounds.x - labelBounds.width })
    //     if (labelPos.y > lastPos.y)
    //         labelBounds = labelBounds.extend({ y: labelBounds.y + labelBounds.height / 2 })

    //     return {
    //         text: lastValue.time.y.toString(),
    //         fontSize: labelFontSize,
    //         bounds: labelBounds
    //     }
    // }

    @computed get allLabels() {
        const { bounds } = this
        const labels = cloneDeep(this.labelCandidates)

        // Ensure labels fit inside bounds
        // Must do before collision detection since it'll change the positions
        for (const l of labels) {
            if (l.bounds.left < bounds.left - 1) {
                l.bounds = l.bounds.extend({ x: l.bounds.x + l.bounds.width })
            } else if (l.bounds.right > bounds.right + 1) {
                l.bounds = l.bounds.extend({ x: l.bounds.x - l.bounds.width })
            }

            if (l.bounds.top < bounds.top - 1) {
                l.bounds = l.bounds.extend({ y: bounds.top })
            } else if (l.bounds.bottom > bounds.bottom + 1) {
                l.bounds = l.bounds.extend({
                    y: bounds.bottom - l.bounds.height
                })
            }
        }

        // Main collision detection
        const labelsByPriority = sortBy(labels, l => -this.labelPriority(l))
        for (let i = 0; i < labelsByPriority.length; i++) {
            const l1 = labelsByPriority[i]
            if (l1.isHidden) continue

            for (let j = i + 1; j < labelsByPriority.length; j++) {
                const l2 = labelsByPriority[j]
                if (l2.isHidden) continue

                if (l1.bounds.intersects(l2.bounds)) {
                    l2.isHidden = true
                }
            }
        }

        return labels
    }

    mouseFrame?: number
    @action.bound onMouseLeave() {
        if (this.mouseFrame !== undefined) cancelAnimationFrame(this.mouseFrame)
        this.mousePos = undefined
    }

    @computed get hoverPoint(): ScatterRenderPoint | undefined {
        const { mousePos } = this
        if (!mousePos) return undefined

        const closestPoint = sortBy(this.values, v => {
            return Vector2.distanceSq(v.position, mousePos)
        })[0]

        if (
            closestPoint &&
            Vector2.distanceSq(closestPoint.position, mousePos) <
                (this.bounds.width / 3) ** 2
        ) {
            return closestPoint
        } else {
            return undefined
        }
    }

    @action.bound onMouseMove(ev: React.MouseEvent<SVGGElement>) {
        if (this.mouseFrame !== undefined) cancelAnimationFrame(this.mouseFrame)

        const nativeEvent = ev.nativeEvent

        this.mouseFrame = requestAnimationFrame(() => {
            runInAction(
                () =>
                    (this.mousePos = getRelativeMouse(
                        this.base.current,
                        nativeEvent
                    ))
            )
        })
    }

    @action.bound onClick() {
        // if (this.props.onClick)
        //     this.props.onClick()
    }

    @computed get backgroundPoints(): ScatterRenderPoint[] {
        return []
    }

    @computed get foregroundPoints(): ScatterRenderPoint[] {
        return this.values
    }

    renderBackgroundPoints() {
        // const { backgroundPoints, isLayerMode, isConnected, hideLines } = this
        // return hideLines ? [] : backgroundPoints.map(group => <ScatterBackgroundLine key={group.key} group={group} isLayerMode={isLayerMode} isConnected={isConnected}/>)
    }

    renderBackgroundLabels() {
        // const { backgroundPoints } = this
        // return <g className="backgroundLabels" fill={"#333"}>
        //     {this.allLabels.map(l =>
        //             !l.isHidden && <text key={}
        //                 x={l.bounds.x.toFixed(2)}
        //                 y={(l.bounds.y + l.bounds.height).toFixed(2)}
        //                 fontSize={l.fontSize.toFixed(2)}
        //             >{l.text}</text>
        //         )
    }

    @computed get renderUid() {
        return guid()
    }

    animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >
    componentDidMount() {
        const radiuses: string[] = []
        this.animSelection = select(this.base.current).selectAll("circle")

        this.animSelection
            .each(function() {
                const circle = this as SVGCircleElement
                radiuses.push(circle.getAttribute("r") as string)
                circle.setAttribute("r", "0")
            })
            .transition()
            .duration(500)
            .attr("r", (_, i) => radiuses[i])
            .on("end", () => this.forceUpdate())
    }

    componentWillUnmount() {
        if (this.animSelection) this.animSelection.interrupt()
    }

    @computed get linesRender() {
        return this.hideLines ? (
            undefined
        ) : (
            <polyline
                strokeLinecap="round"
                stroke={this.series.color}
                points={this.values
                    .map(
                        v =>
                            `${v.position.x.toFixed(2)},${v.position.y.toFixed(
                                2
                            )}`
                    )
                    .join(" ")}
                fill="none"
                strokeWidth={1}
            />
        )
    }

    @computed get pointsRender() {
        return this.values.map((v, i) => {
            return (
                <circle
                    key={`point-${i}`}
                    cx={v.position.x.toFixed(2)}
                    cy={v.position.y.toFixed(2)}
                    r={3}
                    fill={this.series.color}
                />
            )
        })
    }

    @computed get labelsRender() {
        const { labelFontFamily } = this
        return this.allLabels.map(
            (l, i) =>
                !l.isHidden && (
                    <text
                        key={`label-${i}`}
                        x={l.bounds.x.toFixed(2)}
                        y={(l.bounds.y + l.bounds.height).toFixed(2)}
                        fontSize={l.fontSize}
                        fontFamily={labelFontFamily}
                        fill="#333"
                    >
                        {l.text}
                    </text>
                )
        )
    }

    render() {
        const { bounds, renderUid, labelFontFamily } = this
        const clipBounds = bounds.pad(-10)

        if (isEmpty(this.props.data) || isEmpty(this.series.points))
            return <NoDataOverlay bounds={bounds} />

        return (
            <g
                ref={this.base}
                className="PointsWithLabels clickable"
                clipPath={`url(#scatterBounds-${renderUid})`}
                onMouseMove={this.onMouseMove}
                onMouseLeave={this.onMouseLeave}
                onClick={this.onClick}
                fontFamily={labelFontFamily}
            >
                <rect
                    key="background"
                    x={bounds.x}
                    y={bounds.y}
                    width={bounds.width}
                    height={bounds.height}
                    fill="rgba(255,255,255,0)"
                />
                <defs>
                    <clipPath id={`scatterBounds-${renderUid}`}>
                        <rect
                            x={clipBounds.x}
                            y={clipBounds.y}
                            width={clipBounds.width}
                            height={clipBounds.height}
                        />
                    </clipPath>
                </defs>
                {this.linesRender}
                {this.pointsRender}
                {this.labelsRender}
                {this.tooltip}
            </g>
        )
    }
}

@observer
export class TimeScatter extends React.Component<{
    bounds: Bounds
    config: ChartConfig
    isStatic: boolean
}> {
    @computed get chart(): ChartConfig {
        return this.props.config
    }

    @computed get transform() {
        return this.chart.scatter
    }

    @computed.struct get bounds(): Bounds {
        return this.props.bounds
    }

    @action.bound onTargetChange({
        targetStartYear,
        targetEndYear
    }: {
        targetStartYear: TimeBound
        targetEndYear: TimeBound
    }) {
        this.chart.timeDomain = [targetStartYear, targetEndYear]
    }

    @computed get axisBox() {
        const that = this
        return new AxisBox({
            get bounds() {
                return that.bounds
            },
            get fontSize() {
                return that.chart.baseFontSize
            },
            get xAxis() {
                return that.transform.xAxis
            },
            get yAxis() {
                return that.transform.yAxis
            }
        })
    }

    @action.bound onYScaleChange(scaleType: ScaleType) {
        this.chart.yAxis.scaleType = scaleType
    }

    @action.bound onXScaleChange(scaleType: ScaleType) {
        this.chart.xAxis.scaleType = scaleType
    }

    @computed get comparisonLines() {
        return this.chart.comparisonLines
    }

    @computed get hideLines(): boolean {
        return !!this.chart.props.hideConnectedScatterLines
    }

    render() {
        if (this.transform.failMessage)
            return (
                <NoDataOverlay
                    bounds={this.bounds}
                    message={this.transform.failMessage}
                />
            )

        const { transform, axisBox, comparisonLines } = this
        const { currentData, sizeDomain } = transform

        return (
            <g>
                <AxisBoxView
                    axisBox={axisBox}
                    onXScaleChange={this.onXScaleChange}
                    onYScaleChange={this.onYScaleChange}
                    showTickMarks={false}
                />
                {comparisonLines &&
                    comparisonLines.map((line, i) => (
                        <ComparisonLine
                            key={i}
                            axisBox={axisBox}
                            comparisonLine={line}
                        />
                    ))}
                <PointsWithLabels
                    chart={this.chart}
                    hideLines={this.hideLines}
                    data={currentData}
                    bounds={axisBox.innerBounds}
                    xScale={axisBox.xScale}
                    yScale={axisBox.yScale}
                    sizeDomain={sizeDomain}
                    focusKeys={[]}
                    hoverKeys={[]}
                />
            </g>
        )
    }
}
