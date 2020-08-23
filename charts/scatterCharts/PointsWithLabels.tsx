/* PointsWithLabels.tsx
 * ================
 *
 * Core scatterplot renderer
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-09
 */

import * as React from "react"
import { scaleLinear } from "d3-scale"
import {
    some,
    last,
    flatten,
    min,
    find,
    first,
    isEmpty,
    guid,
    getRelativeMouse,
    makeSafeForCSS,
    intersection,
    minBy,
    maxBy,
    sortNumeric
} from "../utils/Util"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "charts/utils/Bounds"
import { NoDataOverlay } from "../core/NoDataOverlay"
import { AxisScale } from "charts/axis/AxisScale"
import { Vector2 } from "charts/utils/Vector2"
import { Triangle } from "./Triangle"
import { select } from "d3-selection"
import { getElementWithHalo } from "./Halos"
import { EntityDimensionKey, SortOrder } from "charts/core/ChartConstants"
import { ColorScale } from "charts/color/ColorScale"
import { MultiColorPolyline } from "./MultiColorPolyline"
import { entityName } from "owidTable/OwidTable"

export interface ScatterSeries {
    color: string
    entityDimensionKey: EntityDimensionKey
    label: string
    size: number
    values: ScatterValue[]
    isScaleColor?: true
}

export interface ScatterValue {
    x: number
    y: number
    size: number
    entityName?: entityName
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
    colorScale?: ColorScale
    sizeDomain: [number, number]
    onMouseOver: (series: ScatterSeries) => void
    onMouseLeave: () => void
    onClick: () => void
    hideLines: boolean
    formatLabel: (v: ScatterValue) => string
}

interface ScatterRenderValue {
    position: Vector2
    color: string
    size: number
    fontSize: number
    label: string
    time: {
        x: number
        y: number
    }
}

interface ScatterRenderSeries {
    entityDimensionKey: EntityDimensionKey
    displayKey: string
    color: string
    size: number
    values: ScatterRenderValue[]
    text: string
    isHover?: boolean
    isFocus?: boolean
    isForeground?: boolean
    offsetVector: Vector2
    startLabel?: ScatterLabel
    midLabels: ScatterLabel[]
    endLabel?: ScatterLabel
    allLabels: ScatterLabel[]
}

interface ScatterLabel {
    text: string
    fontSize: number
    fontWeight: number
    color: string
    bounds: Bounds
    series: ScatterRenderSeries
    isHidden?: boolean
    isStart?: boolean
    isMid?: boolean
    isEnd?: boolean
}

// When there's only a single point in a group (e.g. single year mode)
@observer
class ScatterGroupSingle extends React.Component<{
    group: ScatterRenderSeries
    isLayerMode?: boolean
    isConnected?: boolean
}> {
    render() {
        const { group, isLayerMode, isConnected } = this.props
        const value = first(group.values)
        if (value === undefined) return null

        const color = group.isFocus || !isLayerMode ? value.color : "#e2e2e2"

        const isLabelled = group.allLabels.some(label => !label.isHidden)
        const size =
            !group.isFocus && isConnected ? 1 + value.size / 16 : value.size
        const cx = value.position.x.toFixed(2)
        const cy = value.position.y.toFixed(2)
        const stroke = isLayerMode ? "#bbb" : isLabelled ? "#333" : "#666"

        return (
            <g key={group.displayKey} className={group.displayKey}>
                {group.isFocus && (
                    <circle
                        cx={cx}
                        cy={cy}
                        fill="none"
                        stroke={color}
                        r={(size + 3).toFixed(2)}
                    />
                )}
                <circle
                    cx={cx}
                    cy={cy}
                    r={size.toFixed(2)}
                    fill={color}
                    opacity={0.8}
                    stroke={stroke}
                    strokeWidth={0.5}
                />
            </g>
        )
    }
}

@observer
class ScatterBackgroundLine extends React.Component<{
    group: ScatterRenderSeries
    isLayerMode: boolean
    isConnected: boolean
}> {
    render() {
        const { group, isLayerMode, isConnected } = this.props

        if (group.values.length === 1) {
            return (
                <ScatterGroupSingle
                    group={group}
                    isLayerMode={isLayerMode}
                    isConnected={isConnected}
                />
            )
        } else {
            const firstValue = first(group.values)
            const lastValue = last(group.values)
            if (firstValue === undefined || lastValue === undefined) return null

            let rotation = Vector2.angle(group.offsetVector, Vector2.up)
            if (group.offsetVector.x < 0) rotation = -rotation

            const opacity = 0.7

            return (
                <g key={group.displayKey} className={group.displayKey}>
                    <circle
                        cx={firstValue.position.x.toFixed(2)}
                        cy={firstValue.position.y.toFixed(2)}
                        r={(1 + firstValue.size / 25).toFixed(1)}
                        fill={isLayerMode ? "#e2e2e2" : firstValue.color}
                        stroke="none"
                        opacity={opacity}
                    />
                    <MultiColorPolyline
                        points={group.values.map(v => ({
                            x: v.position.x,
                            y: v.position.y,
                            color: isLayerMode ? "#ccc" : v.color
                        }))}
                        strokeWidth={(0.3 + group.size / 16).toFixed(2)}
                        opacity={opacity}
                    />
                    <Triangle
                        transform={`rotate(${rotation}, ${lastValue.position.x.toFixed(
                            2
                        )}, ${lastValue.position.y.toFixed(2)})`}
                        cx={lastValue.position.x}
                        cy={lastValue.position.y}
                        r={1.5 + lastValue.size / 16}
                        fill={isLayerMode ? "#e2e2e2" : lastValue.color}
                        opacity={opacity}
                    />
                </g>
            )
        }
    }
}

@observer
export class PointsWithLabels extends React.Component<PointsWithLabelsProps> {
    base: React.RefObject<SVGGElement> = React.createRef()
    @computed private get data(): ScatterSeries[] {
        return this.props.data
    }

    @computed private get isConnected(): boolean {
        return some(this.data, g => g.values.length > 1)
    }

    @computed private get focusKeys(): string[] {
        return intersection(
            this.props.focusKeys || [],
            this.data.map(g => g.entityDimensionKey)
        )
    }

    @computed private get hoverKeys(): string[] {
        return this.props.hoverKeys
    }

    // Layered mode occurs when any entity on the chart is hovered or focused
    // Then, a special "foreground" set of entities is rendered over the background
    @computed private get isLayerMode() {
        return this.focusKeys.length > 0 || this.hoverKeys.length > 0
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds
    }

    @computed private get xScale(): AxisScale {
        return this.props.xScale.extend({ range: this.bounds.xRange() })
    }

    @computed private get yScale(): AxisScale {
        return this.props.yScale.extend({ range: this.bounds.yRange() })
    }

    // When focusing multiple entities, we hide some information to declutter
    @computed private get isSubtleForeground(): boolean {
        return (
            this.focusKeys.length > 1 &&
            some(this.props.data, series => series.values.length > 2)
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

    @computed private get labelFontFamily(): string {
        return "Arial, sans-serif"
    }

    @computed private get hideLines(): boolean {
        return this.props.hideLines
    }

    // Pre-transform data for rendering
    @computed get initialRenderData(): ScatterRenderSeries[] {
        const { data, xScale, yScale, sizeScale, fontScale, colorScale } = this
        return sortNumeric(
            data.map(d => {
                const values = d.values.map(v => {
                    const area = sizeScale(v.size || 4)
                    const scaleColor =
                        colorScale !== undefined
                            ? colorScale.getColor(v.color)
                            : undefined
                    return {
                        position: new Vector2(
                            Math.floor(xScale.place(v.x)),
                            Math.floor(yScale.place(v.y))
                        ),
                        color: scaleColor ?? d.color,
                        size: Math.sqrt(area / Math.PI),
                        fontSize: fontScale(d.size || 1),
                        time: v.time,
                        label: this.props.formatLabel(v)
                    }
                })

                return {
                    entityDimensionKey: d.entityDimensionKey,
                    displayKey: "key-" + makeSafeForCSS(d.entityDimensionKey),
                    color: d.color,
                    size: (last(values) as any).size,
                    values: values,
                    text: d.label,
                    midLabels: [],
                    allLabels: [],
                    offsetVector: Vector2.zero
                }
            }),
            d => d.size,
            SortOrder.desc
        )
    }

    private labelPriority(l: ScatterLabel) {
        let priority = l.fontSize

        if (l.series.isHover) priority += 10000
        if (l.series.isFocus) priority += 1000
        if (l.isEnd) priority += 100

        return priority
    }

    // Create the start year label for a series
    private makeStartLabel(
        series: ScatterRenderSeries
    ): ScatterLabel | undefined {
        // No room to label the year if it's a single point
        if (!series.isForeground || series.values.length <= 1) return undefined

        const { labelFontFamily } = this
        const fontSize = series.isForeground
            ? this.isSubtleForeground
                ? 8
                : 9
            : 7
        const firstValue = series.values[0]
        const nextValue = series.values[1]
        const nextSegment = nextValue.position.subtract(firstValue.position)

        const pos = firstValue.position.subtract(
            nextSegment.normalize().times(5)
        )
        let bounds = Bounds.forText(firstValue.label, {
            x: pos.x,
            y: pos.y,
            fontSize: fontSize,
            fontFamily: labelFontFamily
        })
        if (pos.x < firstValue.position.x)
            bounds = new Bounds(
                bounds.x - bounds.width + 2,
                bounds.y,
                bounds.width,
                bounds.height
            )
        if (pos.y > firstValue.position.y)
            bounds = new Bounds(
                bounds.x,
                bounds.y + bounds.height / 2,
                bounds.width,
                bounds.height
            )

        return {
            text: firstValue.label,
            fontSize: fontSize,
            fontWeight: 400,
            color: firstValue.color,
            bounds: bounds,
            series: series,
            isStart: true
        }
    }

    // Make labels for the points between start and end on a series
    // Positioned using normals of the line segments
    private makeMidLabels(series: ScatterRenderSeries): ScatterLabel[] {
        if (
            !series.isForeground ||
            series.values.length <= 1 ||
            (!series.isHover && this.isSubtleForeground)
        )
            return []

        const fontSize = series.isForeground
            ? this.isSubtleForeground
                ? 8
                : 9
            : 7
        const fontWeight = 400
        const { labelFontFamily } = this

        return series.values.slice(1, -1).map((v, i) => {
            const prevPos = i > 0 && series.values[i - 1].position
            const prevSegment = prevPos && v.position.subtract(prevPos)
            const nextPos = series.values[i + 1].position
            const nextSegment = nextPos.subtract(v.position)

            let pos = v.position
            if (prevPos && prevSegment) {
                const normals = prevSegment
                    .add(nextSegment)
                    .normalize()
                    .normals()
                    .map(x => x.times(5))
                const potentialSpots = normals.map(n => v.position.add(n))
                pos = maxBy(potentialSpots, p => {
                    return (
                        Vector2.distance(p, prevPos) +
                        Vector2.distance(p, nextPos)
                    )
                }) as Vector2
            } else {
                pos = v.position.subtract(nextSegment.normalize().times(5))
            }

            let bounds = Bounds.forText(v.label, {
                x: pos.x,
                y: pos.y,
                fontSize: fontSize,
                fontWeight: fontWeight,
                fontFamily: labelFontFamily
            })
            if (pos.x < v.position.x)
                bounds = new Bounds(
                    bounds.x - bounds.width + 2,
                    bounds.y,
                    bounds.width,
                    bounds.height
                )
            if (pos.y > v.position.y)
                bounds = new Bounds(
                    bounds.x,
                    bounds.y + bounds.height / 2,
                    bounds.width,
                    bounds.height
                )

            return {
                text: v.label,
                fontSize: fontSize,
                fontWeight: fontWeight,
                color: v.color,
                bounds: bounds,
                series: series,
                isMid: true
            }
        })
    }

    // Make the end label (entity label) for a series. Will be pushed
    // slightly out based on the direction of the series if multiple values
    // are present
    // This is also the one label in the case of a single point
    private makeEndLabel(series: ScatterRenderSeries): ScatterLabel {
        const { isSubtleForeground, labelFontFamily, hideLines } = this

        const lastValue = last(series.values) as ScatterRenderValue
        const lastPos = lastValue.position
        const fontSize = hideLines
            ? series.isForeground
                ? this.isSubtleForeground
                    ? 8
                    : 9
                : 7
            : lastValue.fontSize *
              (series.isForeground ? (isSubtleForeground ? 1.2 : 1.3) : 1.1)
        const fontWeight = series.isForeground ? 700 : 400

        let offsetVector = Vector2.up
        if (series.values.length > 1) {
            const prevValue = series.values[series.values.length - 2]
            const prevPos = prevValue.position
            offsetVector = lastPos.subtract(prevPos)
        }
        series.offsetVector = offsetVector

        const labelPos = lastPos.add(
            offsetVector
                .normalize()
                .times(series.values.length === 1 ? lastValue.size + 1 : 5)
        )

        let labelBounds = Bounds.forText(series.text, {
            x: labelPos.x,
            y: labelPos.y,
            fontSize: fontSize,
            fontFamily: labelFontFamily
        })

        if (labelPos.x < lastPos.x)
            labelBounds = labelBounds.extend({
                x: labelBounds.x - labelBounds.width
            })
        if (labelPos.y > lastPos.y)
            labelBounds = labelBounds.extend({
                y: labelBounds.y + labelBounds.height / 2
            })

        return {
            text:
                hideLines && series.isForeground
                    ? lastValue.label
                    : series.text,
            fontSize: fontSize,
            fontWeight: fontWeight,
            color: lastValue.color,
            bounds: labelBounds,
            series: series,
            isEnd: true
        }
    }

    @computed private get renderData(): ScatterRenderSeries[] {
        // Draw the largest points first so that smaller ones can sit on top of them
        const renderData = this.initialRenderData

        for (const series of renderData) {
            series.isHover = this.hoverKeys.includes(series.entityDimensionKey)
            series.isFocus = this.focusKeys.includes(series.entityDimensionKey)
            series.isForeground = series.isHover || series.isFocus
            if (series.isHover) series.size += 1
        }

        for (const series of renderData) {
            series.startLabel = this.makeStartLabel(series)
            series.midLabels = this.makeMidLabels(series)
            series.endLabel = this.makeEndLabel(series)
            series.allLabels = [series.startLabel]
                .concat(series.midLabels)
                .concat([series.endLabel])
                .filter(x => x) as ScatterLabel[]
        }

        const labels = flatten(renderData.map(series => series.allLabels))

        // Ensure labels fit inside bounds
        // Must do before collision detection since it'll change the positions
        this.moveLabelsInsideChartBounds(labels, this.bounds)

        const labelsByPriority = sortNumeric(
            labels,
            l => this.labelPriority(l),
            SortOrder.desc
        )
        if (this.focusKeys.length > 0)
            this.hideUnselectedLabels(labelsByPriority)

        this.hideCollidingLabelsByPriority(labelsByPriority)

        return renderData
    }

    private hideUnselectedLabels(labelsByPriority: ScatterLabel[]) {
        labelsByPriority
            .filter(label => !label.series.isFocus && !label.series.isHover)
            .forEach(label => (label.isHidden = true))
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

    private moveLabelsInsideChartBounds(
        labels: ScatterLabel[],
        bounds: Bounds
    ) {
        for (const label of labels) {
            if (label.bounds.left < bounds.left - 1) {
                label.bounds = label.bounds.extend({
                    x: label.bounds.x + label.bounds.width
                })
            } else if (label.bounds.right > bounds.right + 1) {
                label.bounds = label.bounds.extend({
                    x: label.bounds.x - label.bounds.width
                })
            }

            if (label.bounds.top < bounds.top - 1) {
                label.bounds = label.bounds.extend({ y: bounds.top })
            } else if (label.bounds.bottom > bounds.bottom + 1) {
                label.bounds = label.bounds.extend({
                    y: bounds.bottom - label.bounds.height
                })
            }
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

            const closestSeries = minBy(this.renderData, series => {
                /*if (some(series.allLabels, l => !l.isHidden && l.bounds.contains(mouse)))
                    return -Infinity*/

                if (series.values.length > 1) {
                    return min(
                        series.values.slice(0, -1).map((d, i) => {
                            return Vector2.distanceFromPointToLineSq(
                                mouse,
                                d.position,
                                series.values[i + 1].position
                            )
                        })
                    )
                } else {
                    return min(
                        series.values.map(v =>
                            Vector2.distanceSq(v.position, mouse)
                        )
                    )
                }
            })

            /*if (closestSeries)
                this.hoverKey = closestSeries.key
            else
                this.hoverKey = null*/

            if (closestSeries && this.props.onMouseOver) {
                const datum = find(
                    this.data,
                    d =>
                        d.entityDimensionKey ===
                        closestSeries.entityDimensionKey
                )
                if (datum) this.props.onMouseOver(datum)
            }
        })
    }

    @action.bound onClick() {
        if (this.props.onClick) this.props.onClick()
    }

    @computed get backgroundGroups(): ScatterRenderSeries[] {
        return this.renderData.filter(group => !group.isForeground)
    }

    @computed get foregroundGroups(): ScatterRenderSeries[] {
        return this.renderData.filter(group => !!group.isForeground)
    }

    private renderBackgroundGroups() {
        const { backgroundGroups, isLayerMode, isConnected, hideLines } = this

        return hideLines
            ? []
            : backgroundGroups.map(group => (
                  <ScatterBackgroundLine
                      key={group.entityDimensionKey}
                      group={group}
                      isLayerMode={isLayerMode}
                      isConnected={isConnected}
                  />
              ))
    }

    private renderBackgroundLabels() {
        const { backgroundGroups, isLayerMode } = this

        return (
            <g
                className="backgroundLabels"
                fill={!isLayerMode ? "#333" : "#aaa"}
            >
                {backgroundGroups.map(series => {
                    return series.allLabels
                        .filter(l => !l.isHidden)
                        .map(l =>
                            getElementWithHalo(
                                series.displayKey + "-endLabel",
                                <text
                                    x={l.bounds.x.toFixed(2)}
                                    y={(l.bounds.y + l.bounds.height).toFixed(
                                        2
                                    )}
                                    fontSize={l.fontSize.toFixed(2)}
                                    fontWeight={l.fontWeight}
                                    fill={isLayerMode ? "#aaa" : l.color}
                                >
                                    {l.text}
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

    private renderForegroundGroups() {
        const { foregroundGroups, isSubtleForeground, hideLines } = this

        return foregroundGroups.map(series => {
            const lastValue = last(series.values) as ScatterRenderValue
            const strokeWidth =
                (series.isHover ? 3 : isSubtleForeground ? 1.5 : 2) +
                lastValue.size * 0.05

            if (series.values.length === 1) {
                return (
                    <ScatterGroupSingle
                        key={series.displayKey}
                        group={series}
                    />
                )
            } else {
                const firstValue = first(series.values)
                const opacity = isSubtleForeground ? 0.9 : 1
                const radius = strokeWidth / 2 + 1
                let rotation = Vector2.angle(series.offsetVector, Vector2.up)
                if (series.offsetVector.x < 0) rotation = -rotation
                return (
                    <g key={series.displayKey} className={series.displayKey}>
                        <MultiColorPolyline
                            points={series.values.map(v => ({
                                x: v.position.x,
                                y: v.position.y,
                                color: hideLines ? "rgba(0,0,0,0)" : v.color
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
                            series.values
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
            }
        })
    }

    private renderForegroundLabels() {
        const { foregroundGroups, labelFontFamily } = this
        return foregroundGroups.map(series => {
            return series.allLabels
                .filter(l => !l.isHidden)
                .map((l, i) =>
                    getElementWithHalo(
                        `${series.displayKey}-label-${i}`,
                        <text
                            x={l.bounds.x.toFixed(2)}
                            y={(l.bounds.y + l.bounds.height).toFixed(2)}
                            fontSize={l.fontSize}
                            fontFamily={labelFontFamily}
                            fontWeight={l.fontWeight}
                            fill={l.color}
                        >
                            {l.text}
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

    render() {
        //Bounds.debug(flatten(map(this.renderData, d => map(d.labels, 'bounds'))))

        const { bounds, renderData, renderUid, labelFontFamily } = this
        const clipBounds = bounds.pad(-10)

        if (isEmpty(renderData)) return <NoDataOverlay bounds={bounds} />

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
                {this.renderBackgroundGroups()}
                {this.renderBackgroundLabels()}
                {this.renderForegroundGroups()}
                {this.renderForegroundLabels()}
            </g>
        )
    }
}
