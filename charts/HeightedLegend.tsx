/* HeightedLegend.tsx
 * ================
 *
 */

import { action, computed } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"

import { AxisScale } from "./AxisScale"
import { Bounds } from "./Bounds"
import { ChartViewContext, ChartViewContextType } from "./ChartViewContext"
import { AddEntityButton, ControlsOverlay } from "./Controls"
import { DataKey } from "./DataKey"
import { TextWrap } from "./TextWrap"
import {
    cloneDeep,
    flatten,
    includes,
    max,
    min,
    noop,
    sign,
    some,
    sortBy,
    sumBy
} from "./Util"
import { defaultTo } from "./Util"

// Minimum vertical space between two legend items
const LEGEND_ITEM_MIN_SPACING = 2
// Horizontal distance from the end of the chart to the start of the marker
const MARKER_MARGIN = 4
// Marker lines start and end with a horizontal segment, this sets the minimum size of it
const MARKER_HORIZONTAL_SEGMENT = 5
// Need a constant button height which we can use in positioning calculations
const ADD_BUTTON_HEIGHT = 30

export interface HeightedLegendProps {
    items: HeightedLegendItem[]
    maxWidth?: number
    fontSize: number
}

export interface HeightedLegendItem {
    key: string
    label: string
    color: string
    yValue: number
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
    level: number
    totalLevels: number
}

function groupBounds(group: PlacedMark[]): Bounds {
    const first = group[0]
    const last = group[group.length - 1]
    const height = last.bounds.bottom - first.bounds.top
    const width = Math.max(first.bounds.width, last.bounds.width)
    return new Bounds(first.bounds.x, first.bounds.y, width, height)
}

function stackGroupVertically(group: PlacedMark[], y: number) {
    let currentY = y
    group.forEach(mark => {
        mark.bounds = mark.bounds.extend({ y: currentY })
        mark.repositions += 1
        currentY += mark.bounds.height + LEGEND_ITEM_MIN_SPACING
    })
    return group
}

export class HeightedLegend {
    props: HeightedLegendProps

    @computed get fontSize(): number {
        return 0.75 * this.props.fontSize
    }
    @computed get leftPadding(): number {
        return 35
    }
    @computed get maxWidth() {
        return defaultTo(this.props.maxWidth, Infinity)
    }

    @computed.struct get marks(): HeightedLegendMark[] {
        const { fontSize, leftPadding, maxWidth } = this
        const maxTextWidth = maxWidth - leftPadding

        return this.props.items.map(item => {
            const textWrap = new TextWrap({
                text: item.label,
                maxWidth: maxTextWidth,
                fontSize: fontSize
            })
            return {
                item: item,
                textWrap: textWrap,
                width: leftPadding + textWrap.width,
                height: textWrap.height
            }
        })
    }

    @computed get width(): number {
        if (this.marks.length === 0) return 0
        else return defaultTo(max(this.marks.map(d => d.width)), 0)
    }

    constructor(props: HeightedLegendProps) {
        this.props = props
    }
}

export interface HeightedLegendViewProps {
    x: number
    legend: HeightedLegend
    yScale: AxisScale
    focusKeys: DataKey[]
    clickableMarks: boolean
    onMouseOver?: (key: string) => void
    onClick?: (key: string) => void
    onMouseLeave?: () => void
}

@observer
class PlacedMarkView extends React.Component<{
    mark: PlacedMark
    legend: HeightedLegend
    isFocus?: boolean
    needsLines?: boolean
    onMouseOver: () => void
    onClick: () => void
    onMouseLeave?: () => void
}> {
    render() {
        const {
            mark,
            legend,
            isFocus,
            needsLines,
            onMouseOver,
            onMouseLeave,
            onClick
        } = this.props
        const x = mark.origBounds.x
        const markerX1 = x + MARKER_MARGIN
        const markerX2 = x + legend.leftPadding - MARKER_MARGIN
        const step = (markerX2 - markerX1) / (mark.totalLevels + 1)
        const markerXMid = markerX1 + step + mark.level * step
        const lineColor = isFocus ? "#999" : "#eee"
        const textColor = isFocus ? mark.mark.item.color : "#ddd"
        return (
            <g
                className="legendMark"
                onMouseOver={onMouseOver}
                onMouseLeave={onMouseLeave}
                onClick={onClick}
            >
                {needsLines && (
                    <g className="indicator">
                        <path
                            d={`M${markerX1},${mark.origBounds.centerY} H${markerXMid} V${mark.bounds.centerY} H${markerX2}`}
                            stroke={lineColor}
                            strokeWidth={0.5}
                            fill="none"
                        />
                    </g>
                )}
                <rect
                    x={x}
                    y={mark.bounds.y}
                    width={mark.bounds.width}
                    height={mark.bounds.height}
                    fill="#fff"
                    opacity={0}
                />
                {mark.mark.textWrap.render(
                    needsLines ? markerX2 + MARKER_MARGIN : markerX1,
                    mark.bounds.y,
                    { fill: textColor }
                )}
            </g>
        )
    }
}

@observer
export class HeightedLegendView extends React.Component<
    HeightedLegendViewProps
> {
    static contextType = ChartViewContext
    context!: ChartViewContextType

    @computed get onMouseOver(): any {
        return defaultTo(this.props.onMouseOver, noop)
    }
    @computed get onMouseLeave(): any {
        return defaultTo(this.props.onMouseLeave, noop)
    }
    @computed get onClick(): any {
        return defaultTo(this.props.onClick, noop)
    }

    @computed get isFocusMode() {
        return some(this.props.legend.marks, m =>
            includes(this.props.focusKeys, m.item.key)
        )
    }

    // Naive initial placement of each mark at the target height, before collision detection
    @computed get initialMarks(): PlacedMark[] {
        const { legend, x, yScale } = this.props

        return sortBy(
            legend.marks.map(m => {
                // place vertically centered at Y value
                const initialY = yScale.place(m.item.yValue) - m.height / 2
                const origBounds = new Bounds(x, initialY, m.width, m.height)

                // ensure label doesn't go beyond the top or bottom of the chart
                const y = Math.min(
                    Math.max(initialY, yScale.rangeMin),
                    yScale.rangeMax - m.height
                )
                const bounds = new Bounds(x, y, m.width, m.height)

                return {
                    mark: m,
                    y: y,
                    origBounds: origBounds,
                    bounds: bounds,
                    isOverlap: false,
                    repositions: 0,
                    level: 0,
                    totalLevels: 0
                }

                // Ensure list is sorted by the visual position in ascending order
            }),
            m => yScale.place(m.mark.item.yValue)
        )
    }

    @computed get standardPlacement() {
        const { initialMarks } = this
        const { yScale } = this.props

        const groups: PlacedMark[][] = cloneDeep(initialMarks).map(mark => [
            mark
        ])

        let hasOverlap

        do {
            hasOverlap = false
            for (let i = 0; i < groups.length - 1; i++) {
                const topGroup = groups[i]
                const bottomGroup = groups[i + 1]
                const topBounds = groupBounds(topGroup)
                const bottomBounds = groupBounds(bottomGroup)
                if (topBounds.intersects(bottomBounds)) {
                    const overlapHeight =
                        topBounds.bottom -
                        bottomBounds.top +
                        LEGEND_ITEM_MIN_SPACING
                    const newHeight =
                        topBounds.height +
                        LEGEND_ITEM_MIN_SPACING +
                        bottomBounds.height
                    const targetY =
                        topBounds.top -
                        overlapHeight *
                            (bottomGroup.length /
                                (topGroup.length + bottomGroup.length))
                    const overflowTop = Math.max(yScale.rangeMin - targetY, 0)
                    const overflowBottom = Math.max(
                        targetY + newHeight - yScale.rangeMax,
                        0
                    )
                    const newY = targetY + overflowTop - overflowBottom
                    const newGroup = [...topGroup, ...bottomGroup]
                    stackGroupVertically(newGroup, newY)
                    groups.splice(i, 2, newGroup)
                    hasOverlap = true
                    break
                }
            }
        } while (hasOverlap && groups.length > 1)

        for (const group of groups) {
            let currentLevel = 0
            let prevSign = 0
            for (const mark of group) {
                const currentSign = sign(mark.bounds.y - mark.origBounds.y)
                if (prevSign === currentSign) {
                    currentLevel -= currentSign
                }
                mark.level = currentLevel
                prevSign = currentSign
            }
            const minLevel = min(group.map(mark => mark.level)) as number
            const maxLevel = max(group.map(mark => mark.level)) as number
            for (const mark of group) {
                mark.level -= minLevel
                mark.totalLevels = maxLevel - minLevel + 1
            }
        }

        return flatten(groups)
    }

    // Overlapping placement, for when we really can't find a solution without overlaps.
    @computed get overlappingPlacement() {
        const marks = cloneDeep(this.initialMarks)
        for (let i = 0; i < marks.length; i++) {
            const m1 = marks[i]

            for (let j = i + 1; j < marks.length; j++) {
                const m2 = marks[j]
                const isOverlap =
                    !m1.isOverlap && m1.bounds.intersects(m2.bounds)
                if (isOverlap) {
                    m2.isOverlap = true
                }
            }
        }
        return marks
    }

    @computed get placedMarks() {
        const nonOverlappingMinHeight =
            sumBy(this.initialMarks, mark => mark.bounds.height) +
            this.initialMarks.length * LEGEND_ITEM_MIN_SPACING
        const availableHeight = this.context.chart.data.canAddData
            ? this.props.yScale.rangeSize - ADD_BUTTON_HEIGHT
            : this.props.yScale.rangeSize

        // Need to be careful here – the controls overlay will automatically add padding if
        // needed to fit the floating 'Add country' button, therefore decreasing the space
        // available to render the legend.
        // At a certain height, this ends up infinitely toggling between the two placement
        // modes. The overlapping placement allows the button to float without additional
        // padding, which then frees up space, causing the legend to render with
        // standardPlacement.
        // This is why we need to take into account the height of the 'Add country' button.
        if (nonOverlappingMinHeight > availableHeight) {
            return this.overlappingPlacement
        } else {
            return this.standardPlacement
        }
    }

    @computed get backgroundMarks() {
        const { focusKeys } = this.props
        const { isFocusMode } = this
        return this.placedMarks.filter(m =>
            isFocusMode ? !includes(focusKeys, m.mark.item.key) : m.isOverlap
        )
    }

    @computed get focusMarks() {
        const { focusKeys } = this.props
        const { isFocusMode } = this
        return this.placedMarks.filter(m =>
            isFocusMode ? includes(focusKeys, m.mark.item.key) : !m.isOverlap
        )
    }

    @computed get numMovesNeeded() {
        return this.placedMarks.filter(
            m => m.isOverlap || !m.bounds.equals(m.origBounds)
        ).length
    }

    // Does this placement need line markers or is the position of the labels already clear?
    @computed get needsLines(): boolean {
        return this.placedMarks.some(mark => mark.totalLevels > 1)
    }

    renderBackground() {
        const { x, legend } = this.props
        const { backgroundMarks, needsLines } = this

        return backgroundMarks.map(mark => (
            <PlacedMarkView
                key={mark.mark.item.key}
                mark={mark}
                legend={legend}
                needsLines={needsLines}
                onMouseOver={() => this.onMouseOver(mark.mark.item.key)}
                onClick={() => this.onClick(mark.mark.item.key)}
            />
        ))
    }

    // All labels are focused by default, moved to background when mouseover of other label
    renderFocus() {
        const { legend } = this.props
        const { focusMarks, needsLines } = this

        return focusMarks.map(mark => (
            <PlacedMarkView
                key={mark.mark.item.key}
                mark={mark}
                legend={legend}
                isFocus={true}
                needsLines={needsLines}
                onMouseOver={() => this.onMouseOver(mark.mark.item.key)}
                onClick={() => this.onClick(mark.mark.item.key)}
                onMouseLeave={() => this.onMouseLeave(mark.mark.item.key)}
            />
        ))
    }

    @action.bound onAddClick() {
        this.context.chartView.isSelectingData = true
    }

    render() {
        const leftOffset = this.needsLines
            ? this.props.legend.leftPadding
            : this.props.legend.width > 70
            ? 21
            : 5

        return (
            <g
                className="HeightedLegend"
                style={{
                    cursor: this.props.clickableMarks ? "pointer" : "default"
                }}
            >
                {this.renderBackground()}
                {this.renderFocus()}
                {this.context.chart.data.canAddData && (
                    <ControlsOverlay id="add-country">
                        <AddEntityButton
                            x={this.props.x + leftOffset}
                            y={Math.max(
                                0,
                                defaultTo(
                                    min(
                                        this.placedMarks.map(
                                            mark => mark.bounds.top
                                        )
                                    ),
                                    0
                                )
                            )}
                            align="left"
                            verticalAlign="bottom"
                            height={ADD_BUTTON_HEIGHT}
                            label={`Add ${this.context.chart.entityType}`}
                            onClick={this.onAddClick}
                        />
                    </ControlsOverlay>
                )}
            </g>
        )
    }
}
