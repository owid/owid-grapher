/* PointsWithLabels.tsx
 * ================
 *
 * Core scatterplot renderer
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-09
 */

import { scaleLinear, scaleOrdinal, ScaleOrdinal } from "d3-scale"
import { schemeCategory10 } from "d3-scale-chromatic"
import { select } from "d3-selection"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"

import { AxisScale } from "./AxisScale"
import { Bounds } from "./Bounds"
import { Triangle } from "./Marks"
import { NoData } from "./NoData"
import {
    cloneDeep,
    find,
    first,
    flatten,
    guid,
    isEmpty,
    last,
    min,
    some,
    sortBy,
    uniq
} from "./Util"
import { getRelativeMouse, intersection, makeSafeForCSS } from "./Util"
import { Vector2 } from "./Vector2"

export interface ScatterSeries {
    color: string
    key: string
    label: string
    size: number
    values: ScatterValue[]
    isAutoColor?: true
}

export interface ScatterValue {
    x: number
    y: number
    size: number
    color?: string
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
    onMouseOver: (series: ScatterSeries) => void
    onMouseLeave: () => void
    onClick: () => void
    hideLines: boolean
}

interface ScatterRenderValue {
    position: Vector2
    size: number
    fontSize: number
    time: {
        x: number
        y: number
    }
}

interface ScatterRenderSeries {
    key: string
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

        const color = group.isFocus || !isLayerMode ? group.color : "#e2e2e2"

        const isLabelled = group.allLabels.some(label => !label.isHidden)
        const size =
            !group.isFocus && isConnected ? 1 + value.size / 16 : value.size
        const cx = value.position.x.toFixed(2)
        const cy = value.position.y.toFixed(2)
        const stroke = isLabelled ? (isLayerMode ? "#999" : "#333") : "#fff"

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
                    strokeWidth={0.7}
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
            const color = !isLayerMode ? group.color : "#e2e2e2"

            let rotation = Vector2.angle(group.offsetVector, Vector2.up)
            if (group.offsetVector.x < 0) rotation = -rotation

            return (
                <g key={group.displayKey} className={group.displayKey}>
                    <circle
                        cx={firstValue.position.x.toFixed(2)}
                        cy={firstValue.position.y.toFixed(2)}
                        r={(1 + firstValue.size / 16).toFixed(2)}
                        fill={!isLayerMode ? group.color : "#e2e2e2"}
                        stroke="#ccc"
                        opacity={0.6}
                    />
                    <polyline
                        strokeLinecap="round"
                        stroke={isLayerMode ? "#ccc" : group.color}
                        points={group.values
                            .map(
                                v =>
                                    `${v.position.x.toFixed(
                                        2
                                    )},${v.position.y.toFixed(2)}`
                            )
                            .join(" ")}
                        fill="none"
                        strokeWidth={(0.3 + group.size / 16).toFixed(2)}
                        opacity={0.6}
                    />
                    <Triangle
                        transform={`rotate(${rotation}, ${lastValue.position.x.toFixed(
                            2
                        )}, ${lastValue.position.y.toFixed(2)})`}
                        cx={lastValue.position.x}
                        cy={lastValue.position.y}
                        r={1 + lastValue.size / 16}
                        fill={color}
                        stroke="#ccc"
                        strokeWidth={0.2}
                        opacity={0.6}
                    />
                </g>
            )
        }
    }
}

@observer
export class PointsWithLabels extends React.Component<PointsWithLabelsProps> {
    base: React.RefObject<SVGGElement> = React.createRef()
    @computed get data(): ScatterSeries[] {
        return this.props.data
    }

    @computed get isConnected(): boolean {
        return some(this.data, g => g.values.length > 1)
    }

    @computed get focusKeys(): string[] {
        return intersection(
            this.props.focusKeys || [],
            this.data.map(g => g.key)
        )
    }

    @computed get hoverKeys(): string[] {
        return this.props.hoverKeys
    }

    // Layered mode occurs when any entity on the chart is hovered or focused
    // Then, a special "foreground" set of entities is rendered over the background
    @computed get isLayerMode() {
        return this.focusKeys.length > 0 || this.hoverKeys.length > 0
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

    // When focusing multiple entities, we hide some information to declutter
    @computed get isSubtleForeground(): boolean {
        return (
            this.focusKeys.length > 1 &&
            some(this.props.data, series => series.values.length > 2)
        )
    }

    @computed get sizeScale() {
        const sizeScale = scaleLinear()
            .range([10, 1000])
            .domain(this.props.sizeDomain)
        return sizeScale
    }

    @computed get fontScale(): (d: number) => number {
        return scaleLinear()
            .range([10, 13])
            .domain(this.sizeScale.domain())
    }

    @computed get labelFontFamily(): string {
        return "Arial, sans-serif"
    }

    // Used if no color is specified for a series
    @computed get defaultColorScale(): ScaleOrdinal<string, string> {
        return scaleOrdinal(schemeCategory10)
    }

    @computed get hideLines(): boolean {
        return this.props.hideLines
    }

    // Pre-transform data for rendering
    @computed get initialRenderData(): ScatterRenderSeries[] {
        const {
            data,
            xScale,
            yScale,
            defaultColorScale,
            sizeScale,
            fontScale
        } = this
        return sortBy(
            data.map(d => {
                const values = d.values.map(v => {
                    const area = sizeScale(v.size || 4)
                    return {
                        position: new Vector2(
                            Math.floor(xScale.place(v.x)),
                            Math.floor(yScale.place(v.y))
                        ),
                        size: Math.sqrt(area / Math.PI),
                        fontSize: fontScale(d.size || 1),
                        time: v.time
                    }
                })

                return {
                    key: d.key,
                    displayKey: "key-" + makeSafeForCSS(d.key),
                    color: d.color || defaultColorScale(d.key),
                    size: (last(values) as any).size,
                    values: values,
                    text: d.label,
                    midLabels: [],
                    allLabels: [],
                    offsetVector: Vector2.zero
                }
            }),
            d => d.size
        ) as any
    }

    labelPriority(l: ScatterLabel) {
        let priority = l.fontSize

        if (l.series.isHover) priority += 10000
        if (l.series.isFocus) priority += 1000
        if (l.isEnd) priority += 100

        return priority
    }

    // Create the start year label for a series
    makeStartLabel(series: ScatterRenderSeries): ScatterLabel | undefined {
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
        let bounds = Bounds.forText(firstValue.time.y.toString(), {
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
            text: firstValue.time.y.toString(),
            fontSize: fontSize,
            bounds: bounds,
            series: series,
            isStart: true
        }
    }

    // Make labels for the points between start and end on a series
    // Positioned using normals of the line segments
    makeMidLabels(series: ScatterRenderSeries): ScatterLabel[] {
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
                pos = sortBy(potentialSpots, p => {
                    return -(
                        Vector2.distance(p, prevPos) +
                        Vector2.distance(p, nextPos)
                    )
                })[0]
            } else {
                pos = v.position.subtract(nextSegment.normalize().times(5))
            }

            let bounds = Bounds.forText(v.time.y.toString(), {
                x: pos.x,
                y: pos.y,
                fontSize: fontSize,
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
                text: v.time.y.toString(),
                fontSize: fontSize,
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
    makeEndLabel(series: ScatterRenderSeries) {
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
                    ? lastValue.time.y.toString()
                    : series.text,
            fontSize: fontSize,
            bounds: labelBounds,
            series: series,
            isEnd: true
        }
    }

    @computed get renderData(): ScatterRenderSeries[] {
        const {
            initialRenderData,
            hoverKeys,
            focusKeys,
            labelPriority,
            bounds
        } = this

        // Draw the largest points first so that smaller ones can sit on top of them
        const renderData = cloneDeep(sortBy(initialRenderData, d => -d.size))

        for (const series of renderData) {
            series.isHover = hoverKeys.includes(series.key)
            series.isFocus = focusKeys.includes(series.key)
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

        const allLabels = flatten(renderData.map(series => series.allLabels))

        // Ensure labels fit inside bounds
        // Must do before collision detection since it'll change the positions
        for (const l of allLabels) {
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
        const labelsByPriority = sortBy(allLabels, l => -labelPriority(l))
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

        return renderData
    }

    @computed get allColors(): string[] {
        return uniq(this.renderData.map(d => d.color))
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

            const closestSeries = sortBy(this.renderData, series => {
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
            })[0]

            /*if (closestSeries)
                this.hoverKey = closestSeries.key
            else
                this.hoverKey = null*/

            if (closestSeries && this.props.onMouseOver) {
                const datum = find(this.data, d => d.key === closestSeries.key)
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

    renderBackgroundGroups() {
        const { backgroundGroups, isLayerMode, isConnected, hideLines } = this

        return hideLines
            ? []
            : backgroundGroups.map(group => (
                  <ScatterBackgroundLine
                      key={group.key}
                      group={group}
                      isLayerMode={isLayerMode}
                      isConnected={isConnected}
                  />
              ))
    }

    renderBackgroundLabels() {
        const { backgroundGroups, isLayerMode } = this
        return (
            <g
                className="backgroundLabels"
                fill={!isLayerMode ? "#333" : "#aaa"}
            >
                {backgroundGroups.map(series => {
                    return series.allLabels.map(
                        l =>
                            !l.isHidden && (
                                <text
                                    key={series.displayKey + "-endLabel"}
                                    x={l.bounds.x.toFixed(2)}
                                    y={(l.bounds.y + l.bounds.height).toFixed(
                                        2
                                    )}
                                    fontSize={l.fontSize.toFixed(2)}
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

    renderForegroundGroups() {
        const {
            foregroundGroups,
            isSubtleForeground,
            renderUid,
            hideLines
        } = this

        return foregroundGroups.map(series => {
            const lastValue = last(series.values) as ScatterRenderValue
            const strokeWidth =
                (series.isHover ? 3 : isSubtleForeground ? 0.8 : 2) +
                lastValue.size * 0.05

            if (series.values.length === 1) {
                return (
                    <ScatterGroupSingle
                        key={series.displayKey}
                        group={series}
                    />
                )
            } else {
                const firstValue = series.values[0]
                return (
                    <g key={series.displayKey} className={series.displayKey}>
                        <defs>
                            <marker
                                id={`${series.displayKey}-arrow-${renderUid}`}
                                fill={series.color}
                                viewBox="0 -5 10 10"
                                refX={5}
                                refY={0}
                                markerWidth={4}
                                markerHeight={4}
                                orient="auto"
                            >
                                <path d="M0,-5L10,0L0,5" />
                            </marker>
                            <marker
                                id={`${series.displayKey}-circle-${renderUid}`}
                                viewBox="0 0 12 12"
                                refX={4}
                                refY={4}
                                orient="auto"
                                fill={series.color}
                            >
                                <circle cx={4} cy={4} r={4} />
                            </marker>
                        </defs>
                        {series.isFocus && !hideLines && (
                            <circle
                                cx={firstValue.position.x.toFixed(2)}
                                cy={firstValue.position.y.toFixed(2)}
                                r={strokeWidth + 1}
                                fill="none"
                                stroke={series.color}
                                opacity={0.6}
                            />
                        )}
                        <polyline
                            strokeLinecap="round"
                            stroke={hideLines ? "rgba(0,0,0,0)" : series.color}
                            points={series.values
                                .map(
                                    v =>
                                        `${v.position.x.toFixed(
                                            2
                                        )},${v.position.y.toFixed(2)}`
                                )
                                .join(" ")}
                            fill="none"
                            strokeWidth={strokeWidth}
                            opacity={isSubtleForeground ? 0.6 : 1}
                            markerStart={`url(#${series.displayKey}-circle-${renderUid})`}
                            markerMid={`url(#${series.displayKey}-circle-${renderUid})`}
                            markerEnd={
                                hideLines
                                    ? `url(#${series.displayKey}-circle-${renderUid})`
                                    : `url(#${series.displayKey}-arrow-${renderUid})`
                            }
                        />
                    </g>
                )
            }
        })
    }

    renderForegroundLabels() {
        const { foregroundGroups, labelFontFamily } = this
        return foregroundGroups.map(series => {
            return series.allLabels.map(
                (l, i) =>
                    !l.isHidden && (
                        <text
                            key={`${series.displayKey}-label-${i}`}
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

    render() {
        //Bounds.debug(flatten(map(this.renderData, d => map(d.labels, 'bounds'))))

        const { bounds, renderData, renderUid, labelFontFamily } = this
        const clipBounds = bounds.pad(-10)

        if (isEmpty(renderData)) return <NoData bounds={bounds} />

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
