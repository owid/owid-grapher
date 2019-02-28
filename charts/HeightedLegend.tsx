/* HeightedLegend.tsx
 * ================
 *
 */

import * as React from 'react'
import { some, noop, includes, cloneDeep, max, min, sortBy } from './Util'
import { defaultTo } from './Util'
import { computed, reaction, IReactionDisposer } from 'mobx'
import { observer } from 'mobx-react'
import { TextWrap } from './TextWrap'
import { AxisScale } from './AxisScale'
import { Bounds } from './Bounds'
import { ChartViewContextType, ChartViewContext } from './ChartViewContext'

export interface HeightedLegendProps {
    items: HeightedLegendItem[],
    maxWidth?: number,
    fontSize: number
}

export interface HeightedLegendItem {
    key: string,
    label: string,
    color: string,
    yValue: number,
    yRange?: [number, number]
}

interface HeightedLegendMark {
    item: HeightedLegendItem
    textWrap: TextWrap
    width: number
    height: number
}

interface PlacedMark {
    mark: HeightedLegendMark
    origBounds: Bounds
    bounds: Bounds
    isOverlap: boolean
    repositions: number
    groupPosition: number
    groupSize: number
}

export class HeightedLegend {
    props: HeightedLegendProps

    @computed get fontSize(): number { return 0.75*this.props.fontSize }
    @computed get leftPadding(): number { return 35 }
    @computed get maxWidth() { return defaultTo(this.props.maxWidth, Infinity) }

    @computed.struct get marks(): HeightedLegendMark[] {
        const { fontSize, leftPadding, maxWidth } = this
        const maxTextWidth = maxWidth - leftPadding

        return this.props.items.map(item => {
            const textWrap = new TextWrap({ text: item.label, maxWidth: maxTextWidth, fontSize: fontSize })
            return {
                item: item,
                textWrap: textWrap,
                width: leftPadding + textWrap.width,
                height: textWrap.height,
                repositions: 0,
                groupPosition: 0,
                groupSize: 0
            }
        })
    }

    @computed get width(): number {
        if (this.marks.length === 0)
            return 0
        else
            return defaultTo(max(this.marks.map(d => d.width)), 0)
    }

    constructor(props: HeightedLegendProps) {
        this.props = props
    }
}

export interface HeightedLegendViewProps {
    x: number,
    legend: HeightedLegend,
    yScale: AxisScale,
    focusKeys: string[],
    onMouseOver?: (key: string) => void,
    onClick?: (key: string) => void,
    onMouseLeave?: () => void
}

@observer
class PlacedMarkView extends React.Component<{ mark: PlacedMark, legend: HeightedLegend, isFocus?: boolean, needsLines?: boolean, onMouseOver: () => void, onClick: () => void }> {
    render() {
        const {mark, legend, isFocus, needsLines, onMouseOver, onClick} = this.props
        const x = mark.origBounds.x
        const markerX1 = x+5
        const markerX2 = x+legend.leftPadding-5
        const markerXMid = (markerX1+markerX2)/2 - (mark.groupPosition/mark.groupSize)*(markerX2-markerX1-5)
        const lineColor = isFocus ? "#666" : "#ccc"
        return <g className="legendMark" onMouseOver={onMouseOver} onClick={onClick}>
            {needsLines && <g className="indicator">
                <line x1={markerX1} y1={mark.origBounds.centerY} x2={markerXMid} y2={mark.origBounds.centerY} stroke={lineColor} strokeWidth={0.5}/>
                <line x1={markerXMid} y1={mark.origBounds.centerY} x2={markerXMid} y2={mark.bounds.centerY} stroke={lineColor} strokeWidth={0.5}/>
                <line x1={markerXMid} y1={mark.bounds.centerY} x2={markerX2} y2={mark.bounds.centerY} stroke={lineColor} strokeWidth={0.5}/>
            </g>}
            <rect x={x} y={mark.bounds.y} width={mark.bounds.width} height={mark.bounds.height} fill="#fff" opacity={0}/>
            {mark.mark.textWrap.render(needsLines ? markerX2+5 : markerX1, mark.bounds.y, { fill: isFocus ? mark.mark.item.color : "#ccc" })}
        </g>
    }
}

@observer
export class HeightedLegendView extends React.Component<HeightedLegendViewProps> {
    dispose!: IReactionDisposer

    static contextType = ChartViewContext
    context!: ChartViewContextType

    componentDidMount() {
        // Adding padding to make space for "Add entity" button in legend
        this.dispose = reaction(
            () => this.placedMarks,
            () => {
                const { controls } = this.context.chartView
                if (controls.hasLegendButton) {
                    // Cap bottom to 0 because in some cases, like when toggling relative/absolute on a
                    // stacked area, the minimum of bounds.top ends up being some large negative number,
                    // which breaks the chart by setting a negative height.
                    const buttonBottom = Math.max(0, defaultTo(min(this.placedMarks.map(mark => mark.bounds.top)), 0))
                    const buttonLeft = this.props.x + (this.needsLines ? this.props.legend.leftPadding : 5)

                    if (controls.hasLegendButton) {
                        controls.legendButtonBottom = buttonBottom
                        controls.legendButtonLeft = buttonLeft
                    }
                }
            },
            { fireImmediately: true }
        )
    }

    componentWillUnmount() {
        this.dispose()
    }

    @computed get onMouseOver(): any { return defaultTo(this.props.onMouseOver, noop) }
    @computed get onMouseLeave(): any { return defaultTo(this.props.onMouseLeave, noop) }
    @computed get onClick(): any { return defaultTo(this.props.onClick, noop) }

    @computed get isFocusMode() {
        return this.props.focusKeys.length !== this.props.legend.marks.length && some(this.props.legend.marks, m => includes(this.props.focusKeys, m.item.key))
    }

    // Naive initial placement of each mark at the target height, before collision detection
    @computed get initialMarks(): PlacedMark[] {
        const { legend, x, yScale } = this.props

        return sortBy(legend.marks.map(m => {
            const y = yScale.place(m.item.yValue)

            const bounds = new Bounds(x, y - m.height / 2, m.width, m.height)

            return {
                mark: m,
                y: y,
                origBounds: bounds,
                bounds: bounds,
                isOverlap: false,
                repositions: 0,
                groupPosition: 0,
                groupSize: 0
            }

        // Sort by the original data y value rather than the visual position
        // I forget why this is important but it resolves some edge case
        }), m => m.y)

    }

    // Each mark starts at target height. When a conflict is detected, the lower label is pushed down a bit.
    @computed get topDownPlacement() {
        const { initialMarks } = this
        const { yScale } = this.props

        const marks = cloneDeep(initialMarks)
        for (let i = 0; i < marks.length; i++) {
            for (let j = i + 1; j < marks.length; j++) {
                const m1 = marks[i]
                const m2 = marks[j]
                const isOverlap = m1.bounds.intersects(m2.bounds)
                if (isOverlap) {
                    const overlapHeight = (m1.bounds.y + m1.bounds.height) - m2.bounds.y
                    const newBounds = m2.bounds.extend({ y: m2.bounds.y + overlapHeight + 2 })

                    // Don't push off the edge of the chart
                    if (newBounds.bottom > yScale.rangeMax) {
                        m2.isOverlap = true
                    } else {
                        m2.bounds = newBounds
                        m2.repositions += 1
                    }
                }
            }
        }

        // Group adjacent marks together for placing positional indicators
        const groups = []
        let currentGroup = []
        for (const mark of marks) {
            if (currentGroup.length && mark.repositions === 0) {
                groups.push(currentGroup)
                currentGroup = []
            }
            currentGroup.push(mark)
        }
        if (currentGroup.length)
            groups.push(currentGroup)

        for (const group of groups) {
            const middleIndex = Math.floor(group.length/2)
            for (const mark of group) {
                mark.groupPosition = group.indexOf(mark)-middleIndex
                mark.groupSize = group.length
            }
        }

        return marks
    }

    // Inverse placement. Each mark starts at target height. When conflict is detected, upper label is pushed up.
    @computed get bottomUpPlacement() {
        const { initialMarks } = this
        const { yScale } = this.props

        const marks = cloneDeep(initialMarks).reverse()
        for (let i = 0; i < marks.length; i++) {
            const m1 = marks[i]
            if (i === 0 && m1.bounds.bottom > yScale.rangeMax) {
                m1.bounds = m1.bounds.extend({ y: yScale.rangeMax - m1.bounds.height })
            }

            for (let j = i + 1; j < marks.length; j++) {
                const m2 = marks[j]
                const isOverlap = m1.bounds.intersects(m2.bounds)
                if (isOverlap) {
                    const overlapHeight = (m2.bounds.y + m2.bounds.height) - m1.bounds.y
                    const newBounds = m2.bounds.extend({ y: m2.bounds.y - overlapHeight - 2 })

                    // Don't push off the edge of the chart
                    if (newBounds.top < yScale.rangeMin) {
                        m2.isOverlap = true
                    } else {
                        m2.bounds = newBounds
                        m2.repositions -= 1
                    }
                }
            }
        }

        // Group adjacent marks together for placing positional indicators
        const groups = []
        let currentGroup = []
        for (const mark of marks) {
            if (currentGroup.length && mark.repositions === 0) {
                groups.push(currentGroup)
                currentGroup = []
            }
            currentGroup.push(mark)
        }
        if (currentGroup.length)
            groups.push(currentGroup)

        for (const group of groups) {
            const middleIndex = Math.floor(group.length/2)
            for (const mark of group) {
                mark.groupPosition = group.indexOf(mark)-middleIndex
                mark.groupSize = group.length
            }
        }

        return marks
    }

    // Overlapping placement, for when we really can't find a solution without overlaps.
    @computed get overlappingPlacement() {
        const marks = cloneDeep(this.initialMarks)
        for (let i = 0; i < marks.length; i++) {
            const m1 = marks[i]

            for (let j = i + 1; j < marks.length; j++) {
                const m2 = marks[j]
                const isOverlap = !m1.isOverlap && m1.bounds.intersects(m2.bounds)
                if (isOverlap) {
                    m2.isOverlap = true
                }
            }
        }
        return marks
    }

    @computed get placedMarks() {
        const topOverlaps = this.topDownPlacement.filter(m => m.isOverlap).length
        if (topOverlaps === 0) return this.topDownPlacement

        const bottomOverlaps = this.bottomUpPlacement.filter(m => m.isOverlap).length
        if (bottomOverlaps === 0) return this.bottomUpPlacement

        return this.overlappingPlacement
    }

    @computed get backgroundMarks() {
        const { focusKeys } = this.props
        const { isFocusMode } = this
        return this.placedMarks.filter(m => isFocusMode ? !includes(focusKeys, m.mark.item.key) : m.isOverlap)
    }

    @computed get focusMarks() {
        const { focusKeys } = this.props
        const { isFocusMode } = this
        return this.placedMarks.filter(m => isFocusMode ? includes(focusKeys, m.mark.item.key) : !m.isOverlap)
    }

    @computed get numMovesNeeded() {
        return this.placedMarks.filter(m => m.isOverlap || !m.bounds.equals(m.origBounds)).length
    }

    // Does this placement need line markers or is the position of the labels already clear?
    @computed get needsLines(): boolean {
        return this.placedMarks.some(mark => mark.groupSize > 1)
    }

    renderBackground() {
        const { x, legend } = this.props
        const { backgroundMarks, needsLines } = this

        return backgroundMarks.map(mark =>
            <PlacedMarkView key={mark.mark.item.key} mark={mark} legend={legend} needsLines={needsLines} onMouseOver={() => this.onMouseOver(mark.mark.item.key)} onClick={() => this.onClick(mark.mark.item.key)}/>
        )
    }

    // All labels are focused by default, moved to background when mouseover of other label
    renderFocus() {
        const { legend } = this.props
        const { focusMarks, needsLines } = this

        return focusMarks.map(mark =>
            <PlacedMarkView key={mark.mark.item.key} mark={mark} legend={legend} isFocus={true} needsLines={needsLines} onMouseOver={() => this.onMouseOver(mark.mark.item.key)} onClick={() => this.onClick(mark.mark.item.key)}/>
        )
    }

    render() {
        return <g className="HeightedLegend clickable" onMouseLeave={() => this.onMouseLeave()}>
            {this.renderBackground()}
            {this.renderFocus()}
        </g>
    }
}
