// Note: There may be only 1 chart using this, and we should probably look into deleting this class and file.

import * as React from "react"
import { observable, computed, action, runInAction } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "grapher/utils/Bounds"
import { NoDataOverlay } from "grapher/chart/NoDataOverlay"
import { DualAxis, HorizontalAxis, VerticalAxis } from "grapher/axis/Axis"
import { DualAxisComponent } from "grapher/axis/AxisViews"
import { ComparisonLine } from "./ComparisonLine"

import { EntityDimensionKey } from "grapher/core/GrapherConstants"

import {
    sortBy,
    cloneDeep,
    isEmpty,
    guid,
    getRelativeMouse,
    makeSafeForCSS,
    minBy,
} from "grapher/utils/Util"
import { Vector2 } from "grapher/utils/Vector2"
import { select } from "d3-selection"
import { Tooltip } from "grapher/tooltip/Tooltip"
import { ScatterPlotOptionsProvider } from "./ScatterPlotOptionsProvider"

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
    xAxis: HorizontalAxis
    yAxis: VerticalAxis
    sizeDomain: [number, number]
    hideLines: boolean
    options: TimeScatterChartOptionsProvider
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

    @computed get labelFontFamily(): string {
        return "Arial Narrow, Arial, sans-serif"
    }

    @computed get hideLines(): boolean {
        return this.props.hideLines
    }

    @computed get transform() {
        return this.props.options.scatterTransform
    }

    @computed get tooltip() {
        const { hoverPoint, transform } = this
        if (hoverPoint === undefined) return

        const value = hoverPoint.value

        const formatFunction = this.props.options.table.timeColumnFormatFunction

        const year = value.time.span
            ? `${formatFunction(value.time.span[0])} to ${formatFunction(
                  value.time.span[1]
              )}`
            : formatFunction(value.time.y)

        return (
            <Tooltip
                tooltipProvider={this.props.options}
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
                        fontSize: "1em",
                    }}
                >
                    {year}
                </h3>
                <p
                    style={{
                        margin: 0,
                        padding: "0.3em 0.9em",
                        fontSize: "0.8em",
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

    @computed private get xAxis() {
        const view = this.props.xAxis.clone()
        view.range = this.bounds.xRange()
        return view
    }

    @computed private get yAxis() {
        const view = this.props.yAxis.clone()
        view.range = this.bounds.yRange()
        return view
    }

    @computed private get series(): ScatterRenderSeries {
        const { xAxis, yAxis } = this
        const data = cloneDeep(this.props.data[0])

        const points = data.values.map((v) => {
            const area = 1
            return {
                position: new Vector2(
                    Math.floor(xAxis.place(v.x)),
                    Math.floor(yAxis.place(v.y))
                ),
                size: Math.sqrt(area / Math.PI),
                time: v.time,
                value: v,
                fontSize: 8,
            }
        })

        return {
            entityDimensionKey: data.entityDimensionKey,
            displayKey: "key-" + makeSafeForCSS(data.entityDimensionKey),
            color: data.color,
            points: points,
            text: data.label,
            offsetVector: Vector2.zero,
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
        return this.values.map((v) => {
            return {
                text: v.time.y.toString(),
                fontSize: this.labelFontSize,
                value: v,
                bounds: Bounds.forText(v.time.y.toString(), {
                    x: v.position.x + 3,
                    y: v.position.y - 3,
                    fontSize: this.labelFontSize,
                    fontFamily: this.labelFontFamily,
                }),
                isHidden: false,
            }
        })
    }

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
                    y: bounds.bottom - l.bounds.height,
                })
            }
        }

        // Main collision detection
        const labelsByPriority = sortBy(labels, (l) => -this.labelPriority(l))
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

        const closestPoint = minBy(this.values, (v) =>
            Vector2.distanceSq(v.position, mousePos)
        )

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

    renderBackgroundPoints() {}

    renderBackgroundLabels() {}

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
            .each(function () {
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
        return this.hideLines ? undefined : (
            <polyline
                strokeLinecap="round"
                stroke={this.series.color}
                points={this.values
                    .map(
                        (v) =>
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
            return (
                <NoDataOverlay options={this.props.options} bounds={bounds} />
            )

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

interface TimeScatterChartOptionsProvider extends ScatterPlotOptionsProvider {
    foo?: string
}

@observer
export class TimeScatter extends React.Component<{
    bounds: Bounds
    options: TimeScatterChartOptionsProvider
}> {
    @computed get options() {
        return this.props.options
    }

    @computed get transform() {
        return this.options.scatterTransform
    }

    @computed.struct get bounds(): Bounds {
        return this.props.bounds
    }

    // todo: Refactor
    @computed private get dualAxis() {
        const { xAxis, yAxis } = this.transform
        return new DualAxis({
            bounds: this.bounds,
            xAxis,
            yAxis,
        })
    }

    @computed get comparisonLines() {
        return this.options.comparisonLines
    }

    @computed get hideLines(): boolean {
        return !!this.options.hideConnectedScatterLines
    }

    render() {
        if (this.transform.failMessage)
            return (
                <NoDataOverlay
                    options={this.options}
                    bounds={this.bounds}
                    message={this.transform.failMessage}
                />
            )

        const { transform, dualAxis, comparisonLines, options } = this
        const { currentData, sizeDomain } = transform

        return (
            <g>
                <DualAxisComponent
                    isInteractive={options.isInteractive}
                    dualAxis={dualAxis}
                    showTickMarks={false}
                />
                {comparisonLines &&
                    comparisonLines.map((line, i) => (
                        <ComparisonLine
                            key={i}
                            dualAxis={dualAxis}
                            comparisonLine={line}
                        />
                    ))}
                <PointsWithLabels
                    options={this.options}
                    hideLines={this.hideLines}
                    data={currentData}
                    bounds={dualAxis.innerBounds}
                    xAxis={dualAxis.xAxis}
                    yAxis={dualAxis.yAxis}
                    sizeDomain={sizeDomain}
                    focusKeys={[]}
                    hoverKeys={[]}
                />
            </g>
        )
    }
}
