import { scaleLinear } from "d3-scale"
import { select } from "d3-selection"
import { NoDataModal } from "../noDataModal/NoDataModal.js"
import { SortOrder } from "../../coreTable/CoreTableConstants.js"
import { Bounds } from "../../clientUtils/Bounds.js"
import { PointVector } from "../../clientUtils/PointVector.js"
import {
    sortNumeric,
    makeSafeForCSS,
    getRelativeMouse,
    intersection,
    last,
    flatten,
    minBy,
    min,
    first,
    isEmpty,
    guid,
} from "../../clientUtils/Util.js"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { getElementWithHalo } from "./Halos.js"
import { MultiColorPolyline } from "./MultiColorPolyline.js"
import {
    ScatterPointsWithLabelsProps,
    ScatterRenderSeries,
    ScatterLabel,
    ScatterSeries,
    SCATTER_POINT_MIN_RADIUS,
    SCATTER_LINE_MIN_WIDTH,
    SCATTER_POINT_DEFAULT_RADIUS,
    SCATTER_LINE_DEFAULT_WIDTH,
} from "./ScatterPlotChartConstants.js"
import { ScatterLine, ScatterPoint } from "./ScatterPoints.js"
import {
    makeStartLabel,
    makeMidLabels,
    makeEndLabel,
    labelPriority,
} from "./ScatterUtils.js"
import { Triangle } from "./Triangle.js"
import { ColorScale } from "../color/ColorScale.js"
import { ScaleLinear } from "d3-scale"

// This is the component that actually renders the points. The higher level ScatterPlot class renders points, legends, comparison lines, etc.
@observer
export class ScatterPointsWithLabels extends React.Component<ScatterPointsWithLabelsProps> {
    base: React.RefObject<SVGGElement> = React.createRef()
    @computed private get seriesArray(): ScatterSeries[] {
        return this.props.seriesArray
    }

    @computed private get focusedSeriesNames(): string[] {
        return intersection(
            this.props.focusedSeriesNames || [],
            this.seriesArray.map((g) => g.seriesName)
        )
    }

    @computed private get hoveredSeriesNames(): string[] {
        return this.props.hoveredSeriesNames
    }

    // Layered mode occurs when any entity on the chart is hovered or focused
    // Then, a special "foreground" set of entities is rendered over the background
    @computed private get isLayerMode(): boolean {
        return (
            this.focusedSeriesNames.length > 0 ||
            this.hoveredSeriesNames.length > 0
        )
    }

    @computed private get bounds(): Bounds {
        return this.props.dualAxis.innerBounds
    }

    // When focusing multiple entities, we hide some information to declutter
    @computed private get isSubtleForeground(): boolean {
        return (
            this.focusedSeriesNames.length > 1 &&
            this.props.seriesArray.some((series) => series.points.length > 2)
        )
    }

    @computed private get colorScale(): ColorScale | undefined {
        return this.props.colorScale
    }

    @computed private get sizeScale(): ScaleLinear<number, number> {
        return this.props.sizeScale
    }

    @computed private get fontScale(): (d: number) => number {
        return scaleLinear().range([10, 13]).domain(this.sizeScale.domain())
    }

    @computed private get hideConnectedScatterLines(): boolean {
        return this.props.hideConnectedScatterLines
    }

    // Pre-transform data for rendering
    @computed private get initialRenderSeries(): ScatterRenderSeries[] {
        const { seriesArray, sizeScale, fontScale, colorScale, bounds } = this
        const xAxis = this.props.dualAxis.horizontalAxis.clone()
        xAxis.range = bounds.xRange()
        const yAxis = this.props.dualAxis.verticalAxis.clone()
        yAxis.range = this.bounds.yRange()

        return sortNumeric(
            seriesArray.map((series) => {
                const points = series.points.map((point) => {
                    const scaleColor =
                        colorScale !== undefined
                            ? colorScale.getColor(point.color)
                            : undefined
                    const size = Math.max(
                        sizeScale(point.size),
                        this.props.isConnected
                            ? SCATTER_LINE_MIN_WIDTH
                            : SCATTER_POINT_MIN_RADIUS
                    )
                    return {
                        position: new PointVector(
                            Math.floor(xAxis.place(point.x)),
                            Math.floor(yAxis.place(point.y))
                        ),
                        color: scaleColor ?? series.color,
                        size: !isNaN(size)
                            ? size
                            : this.props.isConnected
                            ? SCATTER_LINE_DEFAULT_WIDTH
                            : SCATTER_POINT_DEFAULT_RADIUS,
                        fontSize: fontScale(size),
                        time: point.time,
                        label: point.label,
                    }
                })

                return {
                    seriesName: series.seriesName,
                    displayKey: "key-" + makeSafeForCSS(series.seriesName),
                    color: series.color,
                    size: last(points)!.size,
                    points,
                    text: series.label,
                    midLabels: [],
                    allLabels: [],
                    offsetVector: PointVector.zero,
                }
            }),
            (d) => d.size,
            SortOrder.desc
        )
    }

    @computed private get renderSeries(): ScatterRenderSeries[] {
        // Draw the largest points first so that smaller ones can sit on top of them
        const renderData = this.initialRenderSeries

        for (const series of renderData) {
            series.isHover = this.hoveredSeriesNames.includes(series.seriesName)
            series.isFocus = this.focusedSeriesNames.includes(series.seriesName)
            series.isForeground = series.isHover || series.isFocus
            if (series.isHover) series.size += 1
        }

        for (const series of renderData) {
            series.startLabel = makeStartLabel(
                series,
                this.isSubtleForeground,
                this.hideConnectedScatterLines
            )
            series.midLabels = makeMidLabels(
                series,
                this.isSubtleForeground,
                this.hideConnectedScatterLines
            )
            series.endLabel = makeEndLabel(
                series,
                this.isSubtleForeground,
                this.hideConnectedScatterLines
            )
            series.allLabels = [series.startLabel]
                .concat(series.midLabels)
                .concat([series.endLabel])
                .filter((x) => x) as ScatterLabel[]
        }

        const labels = flatten(renderData.map((series) => series.allLabels))

        // Ensure labels fit inside bounds
        // Must do before collision detection since it'll change the positions
        this.moveLabelsInsideChartBounds(labels, this.bounds)

        const labelsByPriority = sortNumeric(
            labels,
            (l) => labelPriority(l),
            SortOrder.desc
        )
        if (this.focusedSeriesNames.length > 0)
            this.hideUnselectedLabels(labelsByPriority)

        this.hideCollidingLabelsByPriority(labelsByPriority)

        return renderData
    }

    private hideUnselectedLabels(labelsByPriority: ScatterLabel[]): void {
        labelsByPriority
            .filter((label) => !label.series.isFocus && !label.series.isHover)
            .forEach((label) => (label.isHidden = true))
    }

    private hideCollidingLabelsByPriority(
        labelsByPriority: ScatterLabel[]
    ): void {
        for (let i = 0; i < labelsByPriority.length; i++) {
            const higherPriorityLabel = labelsByPriority[i]
            if (higherPriorityLabel.isHidden) continue

            for (let j = i + 1; j < labelsByPriority.length; j++) {
                const lowerPriorityLabel = labelsByPriority[j]
                if (lowerPriorityLabel.isHidden) continue

                const isHighlightedEndLabelOfEqualPriority =
                    lowerPriorityLabel.isEnd &&
                    (lowerPriorityLabel.series.isHover ||
                        lowerPriorityLabel.series.isFocus) &&
                    higherPriorityLabel.series.isHover ===
                        lowerPriorityLabel.series.isHover &&
                    higherPriorityLabel.series.isFocus ===
                        lowerPriorityLabel.series.isFocus

                if (
                    isHighlightedEndLabelOfEqualPriority
                        ? // For highlighted end labels of equal priority, we want to allow some
                          // overlap – labels are still readable even if they overlap
                          higherPriorityLabel.bounds
                              .pad(6) // allow up to 6px of overlap
                              .intersects(lowerPriorityLabel.bounds)
                        : // For non-highlighted labels we want to leave more space between labels,
                          // partly to have a less noisy chart, and partly to prevent readers from
                          // thinking that "everything is labelled". In the past this has made
                          // readers think that if a label doesn't exist, it isn't plotted on the
                          // chart.
                          higherPriorityLabel.bounds
                              .pad(-6)
                              .intersects(lowerPriorityLabel.bounds)
                ) {
                    lowerPriorityLabel.isHidden = true
                }
            }
        }
    }

    // todo: move this to bounds class with a test
    private moveLabelsInsideChartBounds(
        labels: ScatterLabel[],
        bounds: Bounds
    ): void {
        for (const label of labels) {
            if (label.bounds.left < bounds.left - 1)
                label.bounds = label.bounds.set({
                    x: label.bounds.x + label.bounds.width,
                })
            else if (label.bounds.right > bounds.right + 1)
                label.bounds = label.bounds.set({
                    x: label.bounds.x - label.bounds.width,
                })

            if (label.bounds.top < bounds.top - 1)
                label.bounds = label.bounds.set({ y: bounds.top })
            else if (label.bounds.bottom > bounds.bottom + 1)
                label.bounds = label.bounds.set({
                    y: bounds.bottom - label.bounds.height,
                })
        }
    }

    mouseFrame?: number
    @action.bound onMouseLeave(): void {
        if (this.mouseFrame !== undefined) cancelAnimationFrame(this.mouseFrame)

        if (this.props.onMouseLeave) this.props.onMouseLeave()
    }

    @action.bound onMouseMove(ev: React.MouseEvent<SVGGElement>): void {
        if (this.mouseFrame !== undefined) cancelAnimationFrame(this.mouseFrame)

        const nativeEvent = ev.nativeEvent

        this.mouseFrame = requestAnimationFrame(() => {
            if (this.base.current) {
                const mouse = getRelativeMouse(this.base.current, nativeEvent)

                const closestSeries = minBy(this.renderSeries, (series) => {
                    if (series.points.length > 1)
                        return min(
                            series.points.slice(0, -1).map((d, i) => {
                                return PointVector.distanceFromPointToLineSq(
                                    mouse,
                                    d.position,
                                    series.points[i + 1].position
                                )
                            })
                        )

                    return min(
                        series.points.map((v) =>
                            PointVector.distanceSq(v.position, mouse)
                        )
                    )
                })

                if (closestSeries && this.props.onMouseOver) {
                    const series = this.seriesArray.find(
                        (series) =>
                            series.seriesName === closestSeries.seriesName
                    )
                    if (series) this.props.onMouseOver(series)
                }
            }
        })
    }

    @action.bound onClick(): void {
        if (this.props.onClick) this.props.onClick()
    }

    @computed get backgroundSeries(): ScatterRenderSeries[] {
        return this.renderSeries.filter((series) => !series.isForeground)
    }

    @computed get foregroundSeries(): ScatterRenderSeries[] {
        return this.renderSeries.filter((series) => !!series.isForeground)
    }

    private renderBackgroundSeries(): JSX.Element[] {
        const { backgroundSeries, isLayerMode, hideConnectedScatterLines } =
            this

        return hideConnectedScatterLines
            ? []
            : backgroundSeries.map((series) => (
                  <ScatterLine
                      key={series.seriesName}
                      series={series}
                      isLayerMode={isLayerMode}
                  />
              ))
    }

    private renderBackgroundLabels(): JSX.Element {
        const { isLayerMode } = this
        return (
            <g
                className="backgroundLabels"
                fill={!isLayerMode ? "#333" : "#aaa"}
            >
                {this.backgroundSeries.map((series) => {
                    return series.allLabels
                        .filter((label) => !label.isHidden)
                        .map((label) =>
                            getElementWithHalo(
                                series.displayKey + "-endLabel",
                                <text
                                    x={label.bounds.x.toFixed(2)}
                                    y={(
                                        label.bounds.y + label.bounds.height
                                    ).toFixed(2)}
                                    fontSize={label.fontSize.toFixed(2)}
                                    fontWeight={label.fontWeight}
                                    fill={isLayerMode ? "#aaa" : label.color}
                                >
                                    {label.text}
                                </text>
                            )
                        )
                })}
            </g>
        )
    }

    @computed get renderUid(): number {
        return guid()
    }

    private renderForegroundSeries(): JSX.Element[] {
        const { isSubtleForeground, hideConnectedScatterLines } = this
        return this.foregroundSeries.map((series) => {
            const lastPoint = last(series.points)!
            const strokeWidth =
                (hideConnectedScatterLines
                    ? 3
                    : series.isHover
                    ? 3
                    : isSubtleForeground
                    ? 1.5
                    : 2) +
                lastPoint.size / 2

            if (series.points.length === 1)
                return <ScatterPoint key={series.displayKey} series={series} />

            const firstValue = first(series.points)
            const opacity = isSubtleForeground ? 0.9 : 1
            const radius = hideConnectedScatterLines
                ? strokeWidth
                : strokeWidth / 2 + 1
            let rotation = PointVector.angle(
                series.offsetVector,
                PointVector.up
            )
            if (series.offsetVector.x < 0) rotation = -rotation
            return (
                <g key={series.displayKey} className={series.displayKey}>
                    {!hideConnectedScatterLines && (
                        <MultiColorPolyline
                            points={series.points.map((point) => ({
                                x: point.position.x,
                                y: point.position.y,
                                color: point.color,
                            }))}
                            strokeWidth={strokeWidth}
                            opacity={opacity}
                        />
                    )}
                    {(series.isFocus || hideConnectedScatterLines) &&
                        firstValue && (
                            <circle
                                cx={firstValue.position.x.toFixed(2)}
                                cy={firstValue.position.y.toFixed(2)}
                                r={radius}
                                fill={firstValue.color}
                                opacity={opacity}
                                stroke={firstValue.color}
                                strokeOpacity={0.6}
                            />
                        )}
                    {(series.isHover || hideConnectedScatterLines) &&
                        series.points
                            .slice(
                                1,
                                hideConnectedScatterLines ? undefined : -1
                            )
                            .map((v, index) => (
                                <circle
                                    key={index}
                                    cx={v.position.x}
                                    cy={v.position.y}
                                    r={radius}
                                    fill={v.color}
                                    stroke="none"
                                />
                            ))}
                    {!hideConnectedScatterLines && (
                        <Triangle
                            transform={`rotate(${rotation}, ${lastPoint.position.x.toFixed(
                                2
                            )}, ${lastPoint.position.y.toFixed(2)})`}
                            cx={lastPoint.position.x}
                            cy={lastPoint.position.y}
                            r={1.5 + strokeWidth}
                            fill={lastPoint.color}
                            opacity={opacity}
                        />
                    )}
                </g>
            )
        })
    }

    private renderForegroundLabels(): JSX.Element[][] {
        return this.foregroundSeries.map((series) => {
            return series.allLabels
                .filter((label) => !label.isHidden)
                .map((label, index) =>
                    getElementWithHalo(
                        `${series.displayKey}-label-${index}`,
                        <text
                            x={label.bounds.x.toFixed(2)}
                            y={(label.bounds.y + label.bounds.height).toFixed(
                                2
                            )}
                            fontSize={label.fontSize}
                            fontWeight={label.fontWeight}
                            fill={label.color}
                        >
                            {label.text}
                        </text>
                    )
                )
        })
    }

    animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >

    private runAnimation(): void {
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

    componentDidMount(): void {
        if (!this.props.disableIntroAnimation) {
            this.runAnimation()
        }
    }

    componentWillUnmount(): void {
        if (this.animSelection) this.animSelection.interrupt()
    }

    render(): JSX.Element {
        const { bounds, renderSeries, renderUid } = this
        const clipBounds = bounds.pad(-10)

        if (isEmpty(renderSeries))
            return (
                <NoDataModal
                    manager={this.props.noDataModalManager}
                    bounds={bounds}
                />
            )

        return (
            <g
                ref={this.base}
                className="PointsWithLabels clickable"
                clipPath={`url(#scatterBounds-${renderUid})`}
                onMouseMove={this.onMouseMove}
                onMouseLeave={this.onMouseLeave}
                onClick={this.onClick}
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
                {this.renderBackgroundSeries()}
                {this.renderBackgroundLabels()}
                {this.renderForegroundSeries()}
                {this.renderForegroundLabels()}
            </g>
        )
    }
}
