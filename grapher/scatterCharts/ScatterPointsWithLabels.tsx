import { scaleLinear } from "d3-scale"
import { select } from "d3-selection"
import { NoDataModal } from "grapher/noDataModal/NoDataModal"
import { SortOrder } from "grapher/core/GrapherConstants"
import { Bounds } from "grapher/utils/Bounds"
import { PointVector } from "grapher/utils/PointVector"
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
} from "grapher/utils/Util"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { getElementWithHalo } from "./Halos"
import { MultiColorPolyline } from "./MultiColorPolyline"
import {
    ScatterPointsWithLabelsProps,
    ScatterRenderSeries,
    ScatterLabel,
    ScatterRenderPoint,
    ScatterLabelFontFamily,
} from "./ScatterPlotChartConstants"
import { ScatterLine, ScatterPoint } from "./ScatterPoints"
import {
    makeStartLabel,
    makeMidLabels,
    makeEndLabel,
    labelPriority,
} from "./ScatterUtils"
import { Triangle } from "./Triangle"

// This is the component that actually renders the points. The higher level ScatterPlot class renders points, legends, comparison lines, etc.
@observer
export class ScatterPointsWithLabels extends React.Component<
    ScatterPointsWithLabelsProps
> {
    base: React.RefObject<SVGGElement> = React.createRef()
    @computed private get seriesArray() {
        return this.props.seriesArray
    }

    @computed private get isConnected() {
        return this.seriesArray.some((g) => g.points.length > 1)
    }

    @computed private get focusedSeriesNames() {
        return intersection(
            this.props.focusedSeriesNames || [],
            this.seriesArray.map((g) => g.seriesName)
        )
    }

    @computed private get hoveredSeriesNames() {
        return this.props.hoveredSeriesNames
    }

    // Layered mode occurs when any entity on the chart is hovered or focused
    // Then, a special "foreground" set of entities is rendered over the background
    @computed private get isLayerMode() {
        return (
            this.focusedSeriesNames.length > 0 ||
            this.hoveredSeriesNames.length > 0
        )
    }

    @computed private get bounds() {
        return this.props.dualAxis.innerBounds
    }

    // When focusing multiple entities, we hide some information to declutter
    @computed private get isSubtleForeground() {
        return (
            this.focusedSeriesNames.length > 1 &&
            this.props.seriesArray.some((series) => series.points.length > 2)
        )
    }

    @computed private get colorScale() {
        return this.props.colorScale
    }

    @computed private get sizeScale() {
        const sizeScale = scaleLinear()
            .range([10, 1000])
            .domain(this.props.sizeDomain)
        return sizeScale
    }

    @computed private get fontScale(): (d: number) => number {
        return scaleLinear().range([10, 13]).domain(this.sizeScale.domain())
    }

    @computed private get hideLines() {
        return this.props.hideLines
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
                    const area = sizeScale(point.size || 4)
                    const scaleColor =
                        colorScale !== undefined
                            ? colorScale.getColor(point.color)
                            : undefined
                    return {
                        position: new PointVector(
                            Math.floor(xAxis.place(point.x)),
                            Math.floor(yAxis.place(point.y))
                        ),
                        color: scaleColor ?? series.color,
                        size: Math.sqrt(area / Math.PI),
                        fontSize: fontScale(series.size || 1),
                        time: point.time,
                        label: point.label,
                    }
                })

                return {
                    seriesName: series.seriesName,
                    displayKey: "key-" + makeSafeForCSS(series.seriesName),
                    color: series.color,
                    size: (last(points) as any).size,
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
            series.startLabel = makeStartLabel(series, this.isSubtleForeground)
            series.midLabels = makeMidLabels(series, this.isSubtleForeground)
            series.endLabel = makeEndLabel(
                series,
                this.isSubtleForeground,
                this.hideLines
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

    private hideUnselectedLabels(labelsByPriority: ScatterLabel[]) {
        labelsByPriority
            .filter((label) => !label.series.isFocus && !label.series.isHover)
            .forEach((label) => (label.isHidden = true))
    }

    private hideCollidingLabelsByPriority(labelsByPriority: ScatterLabel[]) {
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
    ) {
        for (const label of labels) {
            if (label.bounds.left < bounds.left - 1)
                label.bounds = label.bounds.extend({
                    x: label.bounds.x + label.bounds.width,
                })
            else if (label.bounds.right > bounds.right + 1)
                label.bounds = label.bounds.extend({
                    x: label.bounds.x - label.bounds.width,
                })

            if (label.bounds.top < bounds.top - 1)
                label.bounds = label.bounds.extend({ y: bounds.top })
            else if (label.bounds.bottom > bounds.bottom + 1)
                label.bounds = label.bounds.extend({
                    y: bounds.bottom - label.bounds.height,
                })
        }
    }

    mouseFrame?: number
    @action.bound onMouseLeave() {
        if (this.mouseFrame !== undefined) cancelAnimationFrame(this.mouseFrame)

        if (this.props.onMouseLeave) this.props.onMouseLeave()
    }

    @action.bound onMouseMove(ev: React.MouseEvent<SVGGElement>) {
        if (this.mouseFrame !== undefined) cancelAnimationFrame(this.mouseFrame)

        const nativeEvent = ev.nativeEvent

        this.mouseFrame = requestAnimationFrame(() => {
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
                const datum = this.seriesArray.find(
                    (d) => d.seriesName === closestSeries.seriesName
                )
                if (datum) this.props.onMouseOver(datum)
            }
        })
    }

    @action.bound onClick() {
        if (this.props.onClick) this.props.onClick()
    }

    @computed get backgroundSeries() {
        return this.renderSeries.filter((series) => !series.isForeground)
    }

    @computed get foregroundSeries() {
        return this.renderSeries.filter((series) => !!series.isForeground)
    }

    private renderBackgroundSeries() {
        const { backgroundSeries, isLayerMode, isConnected, hideLines } = this

        return hideLines
            ? []
            : backgroundSeries.map((series) => (
                  <ScatterLine
                      key={series.seriesName}
                      series={series}
                      isLayerMode={isLayerMode}
                      isConnected={isConnected}
                  />
              ))
    }

    private renderBackgroundLabels() {
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

    @computed get renderUid() {
        return guid()
    }

    private renderForegroundSeries() {
        const { isSubtleForeground, hideLines } = this
        return this.foregroundSeries.map((series) => {
            const lastValue = last(series.points) as ScatterRenderPoint
            const strokeWidth =
                (series.isHover ? 3 : isSubtleForeground ? 1.5 : 2) +
                lastValue.size * 0.05

            if (series.points.length === 1)
                return <ScatterPoint key={series.displayKey} series={series} />

            const firstValue = first(series.points)
            const opacity = isSubtleForeground ? 0.9 : 1
            const radius = strokeWidth / 2 + 1
            let rotation = PointVector.angle(
                series.offsetVector,
                PointVector.up
            )
            if (series.offsetVector.x < 0) rotation = -rotation
            return (
                <g key={series.displayKey} className={series.displayKey}>
                    <MultiColorPolyline
                        points={series.points.map((point) => ({
                            x: point.position.x,
                            y: point.position.y,
                            color: hideLines ? "rgba(0,0,0,0)" : point.color,
                        }))}
                        strokeWidth={strokeWidth}
                        opacity={opacity}
                    />
                    {series.isFocus && !hideLines && firstValue && (
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
                    {series.isHover &&
                        !hideLines &&
                        series.points
                            .slice(1, -1)
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
                    <Triangle
                        transform={`rotate(${rotation}, ${lastValue.position.x.toFixed(
                            2
                        )}, ${lastValue.position.y.toFixed(2)})`}
                        cx={lastValue.position.x}
                        cy={lastValue.position.y}
                        r={strokeWidth * 2}
                        fill={lastValue.color}
                        opacity={opacity}
                    />
                </g>
            )
        })
    }

    private renderForegroundLabels() {
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
                            fontFamily={ScatterLabelFontFamily}
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

    private runAnimation() {
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

    componentDidMount() {
        this.runAnimation()
    }

    componentWillUnmount() {
        if (this.animSelection) this.animSelection.interrupt()
    }

    render() {
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
                fontFamily={ScatterLabelFontFamily}
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
