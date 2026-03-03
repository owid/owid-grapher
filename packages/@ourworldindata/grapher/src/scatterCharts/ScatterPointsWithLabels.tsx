import * as _ from "lodash-es"
import * as R from "remeda"
import { type BaseType, type Selection, select } from "d3-selection"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { SortOrder } from "@ourworldindata/types"
import {
    Bounds,
    PointVector,
    sortNumeric,
    getRelativeMouse,
    guid,
    makeFigmaId,
} from "@ourworldindata/utils"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"
import { Halo } from "@ourworldindata/components"
import { MultiColorPolyline } from "./MultiColorPolyline"
import {
    ScatterPointsWithLabelsProps,
    RenderScatterSeries,
    ScatterLabel,
    SCATTER_POINT_HOVER_TARGET_RANGE,
} from "./ScatterPlotChartConstants"
import { ScatterLine, ScatterPoint } from "./ScatterPoints"
import {
    makeStartLabel,
    makeMidLabels,
    makeEndLabel,
    labelPriority,
} from "./ScatterUtils"
import { Triangle } from "./Triangle"
import { GRAPHER_TEXT_OUTLINE_FACTOR } from "../core/GrapherConstants"

// This is the component that actually renders the points. The higher level ScatterPlot class renders points, legends, comparison lines, etc.
@observer
export class ScatterPointsWithLabels extends React.Component<ScatterPointsWithLabelsProps> {
    base = React.createRef<SVGGElement>()

    // closest point by quadtree search (series name)
    private nearSeriesName: string | undefined = undefined
    // currently hovered-over point via mouseenter/leave (series name)
    private overSeriesName: string | undefined = undefined

    constructor(props: ScatterPointsWithLabelsProps) {
        super(props)

        makeObservable<
            ScatterPointsWithLabels,
            "nearSeriesName" | "overSeriesName"
        >(this, {
            nearSeriesName: observable,
            overSeriesName: observable,
        })
    }

    @computed private get isLayerMode(): boolean {
        return this.props.isLayerMode
    }

    @computed private get bounds(): Bounds {
        return this.props.dualAxis.innerBounds
    }

    // When focusing multiple entities, we hide some information to declutter
    @computed private get isSubtleForeground(): boolean {
        const focused = this.props.seriesArray.filter((s) => s.isFocus)
        return (
            focused.length > 1 &&
            this.props.seriesArray.some((series) => series.points.length > 2)
        )
    }

    @computed private get hideScatterLabels(): boolean {
        return !!this.props.hideScatterLabels
    }

    @computed private get hideConnectedScatterLines(): boolean {
        return this.props.hideConnectedScatterLines
    }

    @computed private get focusedSeriesNames(): string[] {
        return this.props.seriesArray
            .filter((s) => s.isFocus)
            .map((s) => s.seriesName)
    }

    @computed private get hoveredSeriesNames(): string[] {
        return this.props.seriesArray
            .filter((s) => s.isHover)
            .map((s) => s.seriesName)
    }

    @computed private get renderSeries(): RenderScatterSeries[] {
        const renderData = this.props.seriesArray
        const labelOpts = {
            isSubtleForeground: this.isSubtleForeground,
            hideConnectedScatterLines: this.hideConnectedScatterLines,
            baseFontSize: this.props.baseFontSize,
        }

        for (const series of renderData) {
            series.midLabels = []
            series.allLabels = []

            series.startLabel = makeStartLabel(series, labelOpts)
            series.midLabels = makeMidLabels(series, labelOpts)
            series.endLabel = makeEndLabel(series, labelOpts)
            series.allLabels = [series.startLabel]
                .concat(series.midLabels)
                .concat([series.endLabel])
                .filter((x) => x) as ScatterLabel[]
        }

        const labels = renderData.flatMap((series) => series.allLabels)

        // Ensure labels fit inside bounds
        // Must do before collision detection since it'll change the positions
        this.moveLabelsInsideChartBounds(labels, this.bounds)

        const labelsByPriority = sortNumeric(
            labels,
            (l) => labelPriority(l),
            SortOrder.desc
        )
        if (this.focusedSeriesNames.length > 0) {
            this.hideUnselectedLabels(labelsByPriority)
        }
        if (this.hideScatterLabels) {
            this.hideLabels(labelsByPriority, this.hoveredSeriesNames.length)
        }
        if (this.hideEntityLabels) {
            this.hideEndLabels(labelsByPriority)
        }

        this.hideCollidingLabelsByPriority(labelsByPriority)

        return renderData
    }

    private hideLabels(
        labelsByPriority: ScatterLabel[],
        nHoveredLabels: number
    ): void {
        labelsByPriority
            .filter((label) => !(label.series.isHover && nHoveredLabels === 1))
            .forEach((label) => (label.isHidden = true))
    }

    private hideEndLabels(labelsByPriority: ScatterLabel[]): void {
        labelsByPriority
            .filter((label) => label.isEnd)
            .forEach((label) => (label.isHidden = true))
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

    // Use a hybrid approach to mouseover:
    // If the mouse is near the centroid of an element, that is prioritized
    // Otherwise we fall back to the dot that the cursor is currently hovering over (if any)

    @action.bound onPointMouseEnter(seriesName: string): void {
        this.overSeriesName = seriesName
        // only select if we're not already close to another point's center
        if (!this.nearSeriesName) this.props.onMouseEnter?.(seriesName)
    }

    @action.bound onPointMouseLeave(): void {
        this.overSeriesName = undefined
        if (!this.nearSeriesName) this.props.onMouseLeave?.()
    }

    @action.bound onMouseMove(ev: React.MouseEvent<SVGGElement>): void {
        if (this.base.current) {
            const { x, y } = getRelativeMouse(this.base.current, ev)

            // be more fine grained about finding nearby points when the cursor is
            // already hovering over a larger dot in the background
            const range = this.overSeriesName
                ? SCATTER_POINT_HOVER_TARGET_RANGE / 4
                : SCATTER_POINT_HOVER_TARGET_RANGE

            // search for closest point to cursor position within range
            const nearby = this.props.quadtree?.find(x, y, range)
            const nearbyName = nearby?.series.seriesName
            if (nearbyName) {
                // only trigger listener if the selection has changed
                if (nearbyName !== this.nearSeriesName) {
                    this.props.onMouseEnter?.(nearbyName)
                }
            } else if (this.nearSeriesName) {
                // if we've just moved out of range of a nearby point, fall back to
                // the currently hovered-over dot (if there is one)
                this.props.onMouseLeave?.()
                if (this.overSeriesName) {
                    this.props.onMouseEnter?.(this.overSeriesName)
                }
            }
            this.nearSeriesName = nearbyName
        }
    }

    @action.bound onMouseLeave(): void {
        // hide tooltip and clear hover state when leaving the chart's bounds
        this.nearSeriesName = undefined
        this.overSeriesName = undefined
        if (this.props.onMouseLeave) this.props.onMouseLeave()
    }

    @action.bound onClick(): void {
        if (this.props.onClick) this.props.onClick()
    }

    @computed get backgroundSeries(): RenderScatterSeries[] {
        return this.renderSeries.filter((series) => !series.isForeground)
    }

    @computed get foregroundSeries(): RenderScatterSeries[] {
        return this.renderSeries.filter((series) => !!series.isForeground)
    }

    private renderBackgroundSeries(): React.ReactElement | null {
        const { backgroundSeries, isLayerMode, hideConnectedScatterLines } =
            this

        if (hideConnectedScatterLines) return null

        return (
            <g id={makeFigmaId("points")}>
                {backgroundSeries.map((series) => (
                    <ScatterLine
                        key={series.seriesName}
                        series={series}
                        isLayerMode={isLayerMode}
                        onMouseEnter={this.onPointMouseEnter}
                        onMouseLeave={this.onPointMouseLeave}
                    />
                ))}
            </g>
        )
    }

    private renderBackgroundLabels(): React.ReactElement {
        const { isLayerMode } = this
        return (
            <g
                id={makeFigmaId("labels")}
                className="backgroundLabels"
                fill={!isLayerMode ? "#333" : "#aaa"}
            >
                {this.backgroundSeries.map((series) => {
                    return series.allLabels
                        .filter((label) => !label.isHidden)
                        .map((label) => (
                            <Halo
                                key={series.displayKey + "-endLabel"}
                                id={makeFigmaId("outline", series.seriesName)}
                                outlineWidth={
                                    GRAPHER_TEXT_OUTLINE_FACTOR * label.fontSize
                                }
                                outlineColor={this.props.backgroundColor}
                            >
                                <text
                                    id={makeFigmaId("label", label.text)}
                                    x={label.bounds.x.toFixed(2)}
                                    y={(
                                        label.bounds.y + label.bounds.height
                                    ).toFixed(2)}
                                    fontSize={label.fontSize.toFixed(2)}
                                    fontWeight={label.fontWeight}
                                    fill={isLayerMode ? "#aaa" : label.color}
                                    style={{ pointerEvents: "none" }}
                                >
                                    {label.text}
                                </text>
                            </Halo>
                        ))
                })}
            </g>
        )
    }

    @computed get renderUid(): number {
        return guid()
    }

    private renderForegroundSeries(): React.ReactElement {
        const { isSubtleForeground, hideConnectedScatterLines } = this
        return (
            <g id={makeFigmaId("points")}>
                {this.foregroundSeries.map((series) => {
                    const lastPoint = R.last(series.placedPoints)!
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
                        return (
                            <ScatterPoint
                                key={series.displayKey}
                                series={series}
                                hideFocusRing={this.props.hideFocusRing}
                                onMouseEnter={this.onPointMouseEnter}
                                onMouseLeave={this.onPointMouseLeave}
                            />
                        )

                    const firstValue = R.first(series.placedPoints)
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
                        <g
                            id={makeFigmaId("time-scatter", series.displayKey)}
                            key={series.displayKey}
                            className={series.displayKey}
                        >
                            {!hideConnectedScatterLines && (
                                <MultiColorPolyline
                                    points={series.placedPoints.map(
                                        (point) => ({
                                            x: point.position.x,
                                            y: point.position.y,
                                            color: point.color,
                                        })
                                    )}
                                    strokeWidth={strokeWidth}
                                    opacity={opacity}
                                />
                            )}
                            {(series.isFocus || hideConnectedScatterLines) &&
                                firstValue && (
                                    <circle
                                        cx={firstValue.position.x}
                                        cy={firstValue.position.y}
                                        r={radius}
                                        fill={firstValue.color}
                                        opacity={opacity}
                                        stroke={firstValue.color}
                                        strokeOpacity={0.6}
                                    />
                                )}
                            {(series.isHover || hideConnectedScatterLines) &&
                                series.placedPoints
                                    .slice(
                                        1,
                                        hideConnectedScatterLines
                                            ? undefined
                                            : -1
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
                                    cx={lastPoint.position.x}
                                    cy={lastPoint.position.y}
                                    r={1.5 + strokeWidth}
                                    rotation={rotation}
                                    fill={lastPoint.color}
                                    opacity={opacity}
                                />
                            )}
                        </g>
                    )
                })}
            </g>
        )
    }

    private renderForegroundLabels(): React.ReactElement {
        return (
            <g id={makeFigmaId("labels")}>
                {this.foregroundSeries.map((series) => {
                    return series.allLabels
                        .filter((label) => !label.isHidden)
                        .map((label, index) => (
                            <Halo
                                id={makeFigmaId("outline", series.seriesName)}
                                key={`${series.displayKey}-label-${index}`}
                                outlineWidth={
                                    GRAPHER_TEXT_OUTLINE_FACTOR * label.fontSize
                                }
                                outlineColor={this.props.backgroundColor}
                            >
                                <text
                                    id={makeFigmaId("label", series.seriesName)}
                                    x={label.bounds.x.toFixed(2)}
                                    y={(
                                        label.bounds.y + label.bounds.height
                                    ).toFixed(2)}
                                    fontSize={label.fontSize}
                                    fontWeight={label.fontWeight}
                                    fill={label.color}
                                >
                                    {label.text}
                                </text>
                            </Halo>
                        ))
                })}
            </g>
        )
    }

    animSelection?: Selection<BaseType, unknown, SVGGElement | null, unknown>

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

    override componentDidMount(): void {
        if (!this.props.disableIntroAnimation) {
            this.runAnimation()
        }
    }

    override componentWillUnmount(): void {
        if (this.animSelection) this.animSelection.interrupt()
    }

    override render(): React.ReactElement {
        const { bounds, renderSeries, renderUid } = this
        const clipBounds = bounds.pad(-10)

        if (_.isEmpty(renderSeries))
            return (
                <NoDataModal
                    manager={this.props.noDataModalManager}
                    bounds={bounds}
                />
            )

        return (
            <g
                ref={this.base}
                id={makeFigmaId("scatter-points")}
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
