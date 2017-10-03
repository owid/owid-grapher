/* HeightedLegend.tsx
 * ================
 *
 */

import * as React from 'react'
import { some, noop, includes, cloneDeep, max, sortBy } from './Util'
import { defaultTo } from './Util'
import { computed } from 'mobx'
import { observer } from 'mobx-react'
import TextWrap from './TextWrap'
import AxisScale from './AxisScale'
import Bounds from './Bounds'

export interface HeightedLegendProps {
    items: HeightedLegendItem[],
    maxWidth?: number
}

export interface HeightedLegendItem {
    key: string,
    label: string,
    color: string,
    yValue: number
}

interface HeightedLegendMark {
    item: HeightedLegendItem,
    textWrap: TextWrap,
    width: number,
    height: number
}

export default class HeightedLegend {
    props: HeightedLegendProps

    @computed get fontSize(): number { return 0.8 }
    @computed get rectSize(): number { return 10 }
    @computed get rectPadding(): number { return 5 }
    @computed get maxWidth() { return defaultTo(this.props.maxWidth, Infinity) }

    @computed.struct get marks(): HeightedLegendMark[] {
        const { fontSize, rectSize, rectPadding, maxWidth } = this
        const maxTextWidth = maxWidth - rectSize - rectPadding

        return this.props.items.map(item => {
            const textWrap = new TextWrap({ text: item.label, maxWidth: maxTextWidth, fontSize: fontSize })
            return {
                item: item,
                textWrap: textWrap,
                width: rectSize + rectPadding + textWrap.width,
                height: Math.max(textWrap.height, rectSize / 4)
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
    onMouseOver?: (color: string) => void,
    onClick?: (color: string) => void,
    onMouseLeave?: () => void
}

@observer
export class HeightedLegendView extends React.Component<HeightedLegendViewProps> {
    @computed get onMouseOver(): any { return defaultTo(this.props.onMouseOver, noop) }
    @computed get onMouseLeave(): any { return defaultTo(this.props.onMouseLeave, noop) }
    @computed get onClick(): any { return defaultTo(this.props.onClick, noop) }

    @computed get isFocusMode() {
        return this.props.focusKeys.length !== this.props.legend.marks.length && some(this.props.legend.marks, m => includes(this.props.focusKeys, m.item.key))
    }

    // Naive initial placement of each mark at the target height, before collision detection
    @computed get initialMarks() {
        const { legend, x, yScale } = this.props

        return sortBy(legend.marks.map(m => {
            const y = yScale.place(m.item.yValue)

            // Don't let them go off the edge
            /*if (y+m.height > yScale.rangeMax) {
                y = yScale.rangeMax-m.height
            } else if (y < yScale.rangeMin) {
                y = yScale.rangeMin
            }*/

            const bounds = new Bounds(x, y - m.height / 2, m.width, m.height)

            return {
                mark: m,
                origBounds: bounds,
                bounds: bounds,
                isOverlap: false
            }
        }), m => m.bounds.y)
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
                    const newBounds = m2.bounds.extend({ y: m2.bounds.y + overlapHeight })

                    // Don't push off the edge of the chart
                    if (newBounds.bottom > yScale.rangeMax) {
                        m2.isOverlap = true
                    } else {
                        m2.bounds = newBounds
                    }
                }
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
                    const newBounds = m2.bounds.extend({ y: m2.bounds.y - overlapHeight })

                    // Don't push off the edge of the chart
                    if (newBounds.top < yScale.rangeMin) {
                        m2.isOverlap = true
                    } else {
                        m2.bounds = newBounds
                    }
                }
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

    renderBackground() {
        const { x, legend } = this.props
        const { rectSize, rectPadding } = legend
        const { backgroundMarks, isFocusMode } = this

        return backgroundMarks.map(mark => {
            const result = <g className="legendMark" onMouseOver={() => this.onMouseOver(mark.mark.item.color)} onMouseLeave={() => this.onMouseLeave()} onClick={() => this.onClick(mark.mark.item.key)}>
                <rect x={x} y={mark.bounds.y} width={mark.bounds.width} height={mark.bounds.height} fill="#fff" opacity={0} />
                <rect x={x} y={mark.bounds.centerY - rectSize / 8} width={rectSize} height={rectSize / 4} fill={isFocusMode ? "#ccc" : mark.mark.item.color} />
                {mark.mark.textWrap.render(x + rectSize + rectPadding, mark.bounds.y, { fill: isFocusMode ? "#ccc" : "#eee" })}
            </g>

            return result
        })
    }

    renderFocus() {
        const { x, legend } = this.props
        const { rectSize, rectPadding } = legend
        const { focusMarks } = this

        return focusMarks.map(mark => {
            const result = <g className="legendMark" onMouseOver={() => this.onMouseOver(mark.mark.item.color)} onMouseLeave={() => this.onMouseLeave()} onClick={() => this.onClick(mark.mark.item.key)}>
                <rect x={x} y={mark.bounds.y} width={mark.bounds.width} height={mark.bounds.height} fill="#fff" opacity={0} />
                <rect x={x} y={mark.bounds.centerY - rectSize / 8} width={rectSize} height={rectSize / 4} fill={mark.mark.item.color} />
                {mark.mark.textWrap.render(x + rectSize + rectPadding, mark.bounds.y, { fill: "#333" })}
            </g>

            return result
        })
    }

    render() {
        return <g className="HeightedLegend clickable">
            {this.renderBackground()}
            {this.renderFocus()}
        </g>
    }
}
