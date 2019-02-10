import * as React from 'react'
import { observable, computed, action } from 'mobx'
import { observer } from 'mobx-react'
import { Bounds } from './Bounds'
import { ChartConfig } from './ChartConfig'
import { NoData } from './NoData'
import { AxisBox, AxisBoxView } from './AxisBox'
import { ComparisonLine } from './ComparisonLine'
import { ScaleType } from './AxisScale'


import { some, last, sortBy, cloneDeep, each, includes, filter, flatten, min, find, first, isEmpty, guid } from './Util'
import { AxisScale } from './AxisScale'
import { getRelativeMouse, makeSafeForCSS } from './Util'
import { Vector2 } from './Vector2'
import { Triangle } from './Marks'
import { select } from 'd3-selection'

interface PositionedLabel {
    text: string
    fontSize: string
    fontFamily: string
    bounds: Bounds
}

interface LabelCandidate {
    text: string
    fontSize: number
    fontFamily: string
    possiblePositions: Vector2[]
}

function positionLabels(labels: LabelCandidate[]): PositionedLabel[] {
    return labels.map(l => {
        const pos = l.possiblePositions[0]

        return {
            text: l.text,
            fontSize: l.fontSize,
            fontFamily: l.fontFamily,
            bounds: Bounds.forText(l.text, { x: pos.x, y: pos.y, fontSize: l.fontSize, fontFamily: l.fontFamily })
        }
    })
}

class LabelPositioner {

}

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
        x: number,
        y: number,
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
    values: ScatterRenderValue[]
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

// When there's only a single point in a group (e.g. single year mode)
@observer
class ScatterPointSingle extends React.Component<{ group: ScatterRenderSeries, isLayerMode?: boolean, isConnected?: boolean }> {
    render() {
        const {group, isLayerMode, isConnected} = this.props
        const value = first(group.values) as ScatterRenderValue
        const color = (group.isFocus || !isLayerMode) ? group.color : "#e2e2e2"

        const size = (!group.isFocus && isConnected) ? 1 + value.size / 16 : value.size
        const cx = value.position.x.toFixed(2)
        const cy = value.position.y.toFixed(2)
        const stroke = "#999"

        return <g key={group.displayKey} className={group.displayKey}>
            {group.isFocus && <circle cx={cx} cy={cy} fill="none" stroke={color} r={(size + 3).toFixed(2)} />}
            <circle cx={cx} cy={cy} r={size.toFixed(2)} fill={color} opacity={0.8} stroke={stroke} strokeWidth={0.7}/>
        </g>
    }
}

@observer
export class PointsWithLabels extends React.Component<PointsWithLabelsProps> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @observable.ref hoverIndex?: number

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

    @computed get series(): ScatterRenderSeries {
        const { xScale, yScale } = this
        const d = cloneDeep(this.props.data[0])

        const values = d.values.map(v => {
            const area = 1
            return {
                position: new Vector2(
                    Math.floor(xScale.place(v.x)),
                    Math.floor(yScale.place(v.y))
                ),
                size: Math.sqrt(area / Math.PI),
                time: v.time,
                fontSize: 8
            }
        })

        return {
            key: d.key,
            displayKey: "key-" + makeSafeForCSS(d.key),
            color: d.color || "#002147",
            values: values,
            text: d.label,
            offsetVector: Vector2.zero
        }
    }

    @computed get allPoints(): ScatterRenderValue[] {
        return this.series.values
    }

    labelPriority(l: ScatterLabel) {
        let priority = l.fontSize

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
        return this.allPoints.map(v => {
            return {
                text: v.time.y.toString(),
                fontSize: this.labelFontSize,
                possiblePositions: 
            }
        })
    }

    @computed get labels(): LabelPositioner {
    }

    @computed get startLabel(): ScatterLabel|undefined {
        const { series, labelFontFamily, labelFontSize } = this
        if (series.values.length === 1)
            return undefined

        const firstValue = series.values[0]
        const nextValue = series.values[1]
        const nextSegment = nextValue.position.subtract(firstValue.position)

        const pos = firstValue.position.subtract(nextSegment.normalize().times(5))
        let bounds = Bounds.forText(firstValue.time.y.toString(), { x: pos.x, y: pos.y, fontSize: labelFontSize, fontFamily: labelFontFamily })
        if (pos.x < firstValue.position.x)
            bounds = new Bounds(bounds.x - bounds.width + 2, bounds.y, bounds.width, bounds.height)
        if (pos.y > firstValue.position.y)
            bounds = new Bounds(bounds.x, bounds.y + bounds.height / 2, bounds.width, bounds.height)

        return {
            text: firstValue.time.y.toString(),
            fontSize: labelFontSize,
            bounds: bounds
        }

    }

    // Make labels for the points between start and end on a series
    // Positioned using normals of the line segmen
    @computed get midLabels(): ScatterLabel[] {
        const { labelFontFamily, labelFontSize, series } = this

        return series.values.slice(1, -1).map((v, i) => {
            const prevPos = i > 0 && series.values[i - 1].position
            const prevSegment = prevPos && v.position.subtract(prevPos)
            const nextPos = series.values[i + 1].position
            const nextSegment = nextPos.subtract(v.position)

            let pos = v.position
            if (prevPos && prevSegment) {
                const normals = prevSegment.add(nextSegment).normalize().normals().map(x => x.times(5))
                const potentialSpots = normals.map(n => v.position.add(n))
                pos = sortBy(potentialSpots, p => {
                    return -(Vector2.distance(p, prevPos) + Vector2.distance(p, nextPos))
                })[0]
            } else {
                pos = v.position.subtract(nextSegment.normalize().times(5))
            }

            let bounds = Bounds.forText(v.time.y.toString(), { x: pos.x, y: pos.y, fontSize: labelFontSize, fontFamily: labelFontFamily })
            if (pos.x < v.position.x)
                bounds = new Bounds(bounds.x - bounds.width + 2, bounds.y, bounds.width, bounds.height)
            if (pos.y > v.position.y)
                bounds = new Bounds(bounds.x, bounds.y + bounds.height / 2, bounds.width, bounds.height)

            return {
                text: v.time.y.toString(),
                fontSize: labelFontSize,
                bounds: bounds,
                series: series
            }
        })
    }

    @computed get offsetVector() {
        let offsetVector = Vector2.up
        const {series} = this
        const lastValue = last(series.values) as ScatterRenderValue
        const lastPos = lastValue.position

        if (series.values.length > 1) {
            const prevValue = series.values[series.values.length - 2]
            const prevPos = prevValue.position
            offsetVector = lastPos.subtract(prevPos)
        }

        return offsetVector
    }

    // Make the end label (entity label) for a series. Will be pushed
    // slightly out based on the direction of the series if multiple values
    // are present
    // This is also the one label in the case of a single point
    @computed get endLabel(): ScatterLabel {
        const { series, labelFontSize, labelFontFamily, offsetVector } = this

        const lastValue = last(this.allPoints) as ScatterRenderValue
        const lastPos = lastValue.position
        const labelPos = lastPos.add(offsetVector.normalize().times(series.values.length === 1 ? lastValue.size + 1 : 5))

        let labelBounds = Bounds.forText(series.text, { x: labelPos.x, y: labelPos.y, fontSize: labelFontSize, fontFamily: labelFontFamily })

        if (labelPos.x < lastPos.x)
            labelBounds = labelBounds.extend({ x: labelBounds.x - labelBounds.width })
        if (labelPos.y > lastPos.y)
            labelBounds = labelBounds.extend({ y: labelBounds.y + labelBounds.height / 2 })

        return {
            text: lastValue.time.y.toString(),
            fontSize: labelFontSize,
            bounds: labelBounds
        }
    }

    @computed get allLabels() {
        const {bounds} = this
        const labels = [this.startLabel].concat(this.midLabels).concat([this.endLabel]).filter(x => x) as ScatterLabel[]

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
                l.bounds = l.bounds.extend({ y: bounds.bottom - l.bounds.height })
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
        // if (this.mouseFrame !== undefined)
        //     cancelAnimationFrame(this.mouseFrame)

        // if (this.props.onMouseLeave)
        //     this.props.onMouseLeave()
    }

    @action.bound onMouseMove(ev: React.MouseEvent<SVGGElement>) {
        // if (this.mouseFrame !== undefined)
        //     cancelAnimationFrame(this.mouseFrame)

        // const nativeEvent = ev.nativeEvent

        // this.mouseFrame = requestAnimationFrame(() => {
        //     const mouse = getRelativeMouse(this.base.current, nativeEvent)

        //     const closestSeries = sortBy(this.renderData, (series) => {
        //         if (series.values.length > 1) {
        //             return min(series.values.slice(0, -1).map((d, i) => {
        //                 return Vector2.distanceFromPointToLineSq(mouse, d.position, series.values[i + 1].position)
        //             }))
        //         } else {
        //             return min(series.values.map(v => Vector2.distanceSq(v.position, mouse)))
        //         }
        //     })[0]

        //     if (closestSeries && this.props.onMouseOver) {
        //         const datum = find(this.data, d => d.key === closestSeries.key)
        //         if (datum)
        //             this.props.onMouseOver(datum)
        //     }
        // })
    }

    @action.bound onClick() {
        // if (this.props.onClick)
        //     this.props.onClick()
    }

    @computed get backgroundPoints(): ScatterRenderValue[] {
        return []
    }

    @computed get foregroundPoints(): ScatterRenderValue[] {
        return this.allPoints
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

    animSelection?: d3.Selection<d3.BaseType, {}, SVGGElement | null, {}>
    componentDidMount() {
        const radiuses: string[] = []
        this.animSelection = select(this.base.current).selectAll("circle")
        
        this.animSelection.each(function() {
            const circle = this as SVGCircleElement
            radiuses.push(circle.getAttribute('r') as string)
            circle.setAttribute('r', "0")
        }).transition().duration(500).attr('r', (_, i) => radiuses[i])
            .on("end", () => this.forceUpdate())
    }

    componentWillUnmount() {
        if (this.animSelection) this.animSelection.interrupt()
    }

    renderLines() {
        return this.hideLines ? undefined : <polyline
            strokeLinecap="round"
            stroke={this.series.color}
            points={this.allPoints.map(v => `${v.position.x.toFixed(2)},${v.position.y.toFixed(2)}`).join(' ')}
            fill="none"
            strokeWidth={1}
        />
    }

    renderPoints() {
        return this.allPoints.map((v, i) => {
            if (!this.hideLines && v === last(this.allPoints)) {
                let rotation = Vector2.angle(this.offsetVector, Vector2.up)
                if (this.offsetVector.x < 0) rotation = -rotation
    
                return <Triangle
                    key={`point-${i}`}
                    transform={`rotate(${rotation}, ${v.position.x.toFixed(2)}, ${v.position.y.toFixed(2)})`}
                    cx={v.position.x}
                    cy={v.position.y}
                    r={3}
                    fill={this.series.color}
                />  
            } else {
                return <circle
                    key={`point-${i}`}
                    cx={v.position.x.toFixed(2)}
                    cy={v.position.y.toFixed(2)}
                    r={3}
                    fill={this.series.color}
                />
            }
        })
    }

    renderLabels() {
        const { labelFontFamily } = this
        return this.allLabels.map((l, i) =>
                !l.isHidden && <text
                    key={`label-${i}`}
                    x={l.bounds.x.toFixed(2)}
                    y={(l.bounds.y + l.bounds.height).toFixed(2)}
                    fontSize={l.fontSize}
                    fontFamily={labelFontFamily}
                    fill="#333">{l.text}</text>
        )
    }

    render() {
        const { bounds, renderUid, labelFontFamily } = this
        const clipBounds = bounds.pad(-10)

        if (isEmpty(this.props.data) || isEmpty(this.series.values))
            return <NoData bounds={bounds} />

        return <g ref={this.base} className="PointsWithLabels clickable" clipPath={`url(#scatterBounds-${renderUid})`} onMouseMove={this.onMouseMove} onMouseLeave={this.onMouseLeave} onClick={this.onClick} fontFamily={labelFontFamily}>
            <rect key="background" x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="rgba(255,255,255,0)" />
            <defs>
                <clipPath id={`scatterBounds-${renderUid}`}>
                    <rect x={clipBounds.x} y={clipBounds.y} width={clipBounds.width} height={clipBounds.height} />
                </clipPath>
            </defs>
            {this.renderLines()}
            {this.renderPoints()}
            {this.renderLabels()}
        </g>
    }
}


@observer
export class TimeScatter extends React.Component<{ bounds: Bounds, config: ChartConfig, isStatic: boolean }> {
    @computed get chart(): ChartConfig {
        return this.props.config
    }

    @computed get transform() {
        return this.chart.scatter
    }

    @computed.struct get bounds(): Bounds {
        return this.props.bounds
    }

    @action.bound onTargetChange({ targetStartYear, targetEndYear }: { targetStartYear: number, targetEndYear: number }) {
        this.chart.timeDomain = [targetStartYear, targetEndYear]
    }

    @computed get axisBox() {
        const that = this
        return new AxisBox({
            get bounds() { return that.bounds },
            get fontSize() { return that.chart.baseFontSize },
            get xAxis() { return that.transform.xAxis },
            get yAxis() { return that.transform.yAxis }
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
            return <NoData bounds={this.bounds} message={this.transform.failMessage} />

        const { transform, axisBox, comparisonLines } = this
        const { currentData, sizeDomain } = transform

        return <g>
            <AxisBoxView axisBox={axisBox} onXScaleChange={this.onXScaleChange} onYScaleChange={this.onYScaleChange} />
            {comparisonLines && comparisonLines.map((line, i) => <ComparisonLine key={i} axisBox={axisBox} comparisonLine={line} />)}
            <PointsWithLabels hideLines={this.hideLines} data={currentData} bounds={axisBox.innerBounds} xScale={axisBox.xScale} yScale={axisBox.yScale} sizeDomain={sizeDomain} focusKeys={[]} hoverKeys={[]}/>
        </g>
    }
}