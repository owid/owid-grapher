/* HeightedLegend.tsx
 * ================
 *
 */

import * as React from "react"
import {
    some,
    noop,
    includes,
    cloneDeep,
    max,
    min,
    sortBy,
    sumBy,
    flatten,
    sign
} from "./Util"
import { defaultTo } from "./Util"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { TextWrap } from "./TextWrap"
import { AxisScale } from "./AxisScale"
import { Bounds } from "./Bounds"
import { ChartViewContextType, ChartViewContext } from "./ChartViewContext"
import { ControlsOverlay, AddEntityButton } from "./Controls"
import { EntityDimensionKey } from "./EntityDimensionKey"

// Minimum vertical space between two legend items
const LEGEND_ITEM_MIN_SPACING = 2
// Horizontal distance from the end of the chart to the start of the marker
const MARKER_MARGIN = 4
// Need a constant button height which we can use in positioning calculations
const ADD_BUTTON_HEIGHT = 30

export interface HeightedLegendItem {
    entityDimensionKey: EntityDimensionKey
    label: string
    color: string
    yValue: number
    annotation?: string
    yRange?: [number, number]
}

interface HeightedLegendMark {
    item: HeightedLegendItem
    textWrap: TextWrap
    annotationTextWrap?: TextWrap
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

export interface HeightedLegendProps {
    items: HeightedLegendItem[]
    maxWidth?: number
    fontSize: number
}

export class HeightedLegend {
    props: HeightedLegendProps

    @computed private get fontSize(): number {
        return 0.75 * this.props.fontSize
    }
    @computed get leftPadding(): number {
        return 35
    }
    @computed private get maxWidth() {
        return defaultTo(this.props.maxWidth, Infinity)
    }

    @computed.struct get marks(): HeightedLegendMark[] {
        const { fontSize, leftPadding, maxWidth } = this
        const maxTextWidth = maxWidth - leftPadding
        const maxAnnotationWidth = Math.min(maxTextWidth, 150)

        return this.props.items.map(item => {
            const annotationTextWrap = item.annotation
                ? new TextWrap({
                      text: item.annotation,
                      maxWidth: maxAnnotationWidth,
                      fontSize: fontSize * 0.9
                  })
                : undefined
            const textWrap = new TextWrap({
                text: item.label,
                maxWidth: maxTextWidth,
                fontSize
            })
            return {
                item,
                textWrap,
                annotationTextWrap,
                width:
                    leftPadding +
                    Math.max(
                        textWrap.width,
                        annotationTextWrap ? annotationTextWrap.width : 0
                    ),
                height:
                    textWrap.height +
                    (annotationTextWrap ? annotationTextWrap.height : 0)
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

export interface HeightedLegendComponentProps {
    x: number
    legend: HeightedLegend
    yScale: AxisScale
    focusKeys: EntityDimensionKey[]
    areMarksClickable: boolean
    onMouseOver?: (key: EntityDimensionKey) => void
    onClick?: (key: EntityDimensionKey) => void
    onMouseLeave?: () => void
}

@observer
class PlacedMarkComponent extends React.Component<{
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
        const annotationColor = isFocus ? "#333" : "#ddd"
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
                {mark.mark.annotationTextWrap &&
                    mark.mark.annotationTextWrap.render(
                        needsLines ? markerX2 + MARKER_MARGIN : markerX1,
                        mark.bounds.y + mark.mark.textWrap.height,
                        {
                            fill: annotationColor,
                            className: "textAnnotation",
                            style: { fontWeight: "lighter" }
                        }
                    )}
            </g>
        )
    }
}

@observer
export class HeightedLegendComponent extends React.Component<
    HeightedLegendComponentProps
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
            includes(this.props.focusKeys, m.item.entityDimensionKey)
        )
    }

    // Naive initial placement of each mark at the target height, before collision detection
    @computed private get initialMarks(): PlacedMark[] {
        const { legend, x, yScale } = this.props

        return sortBy(
            legend.marks.map(mark => {
                // place vertically centered at Y value
                const initialY =
                    yScale.place(mark.item.yValue) - mark.height / 2
                const origBounds = new Bounds(
                    x,
                    initialY,
                    mark.width,
                    mark.height
                )

                // ensure label doesn't go beyond the top or bottom of the chart
                const y = Math.min(
                    Math.max(initialY, yScale.rangeMin),
                    yScale.rangeMax - mark.height
                )
                const bounds = new Bounds(x, y, mark.width, mark.height)

                return {
                    mark: mark,
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
            mark => yScale.place(mark.mark.item.yValue)
        )
    }

    @computed get standardPlacement() {
        const { yScale } = this.props

        const groups: PlacedMark[][] = cloneDeep(
            this.initialMarks
        ).map(mark => [mark])

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

    @computed private get backgroundMarks() {
        const { focusKeys } = this.props
        const { isFocusMode } = this
        return this.placedMarks.filter(m =>
            isFocusMode
                ? !includes(focusKeys, m.mark.item.entityDimensionKey)
                : m.isOverlap
        )
    }

    @computed private get focusMarks() {
        const { focusKeys } = this.props
        const { isFocusMode } = this
        return this.placedMarks.filter(m =>
            isFocusMode
                ? includes(focusKeys, m.mark.item.entityDimensionKey)
                : !m.isOverlap
        )
    }

    // TODO: looks unused. Can we remove?
    @computed get numMovesNeeded() {
        return this.placedMarks.filter(
            m => m.isOverlap || !m.bounds.equals(m.origBounds)
        ).length
    }

    // Does this placement need line markers or is the position of the labels already clear?
    @computed private get needsLines(): boolean {
        return this.placedMarks.some(mark => mark.totalLevels > 1)
    }

    private renderBackground() {
        return this.backgroundMarks.map(mark => (
            <PlacedMarkComponent
                key={mark.mark.item.entityDimensionKey}
                mark={mark}
                legend={this.props.legend}
                needsLines={this.needsLines}
                onMouseOver={() =>
                    this.onMouseOver(mark.mark.item.entityDimensionKey)
                }
                onClick={() => this.onClick(mark.mark.item.entityDimensionKey)}
            />
        ))
    }

    // All labels are focused by default, moved to background when mouseover of other label
    private renderFocus() {
        return this.focusMarks.map(mark => (
            <PlacedMarkComponent
                key={mark.mark.item.entityDimensionKey}
                mark={mark}
                legend={this.props.legend}
                isFocus={true}
                needsLines={this.needsLines}
                onMouseOver={() =>
                    this.onMouseOver(mark.mark.item.entityDimensionKey)
                }
                onClick={() => this.onClick(mark.mark.item.entityDimensionKey)}
                onMouseLeave={() =>
                    this.onMouseLeave(mark.mark.item.entityDimensionKey)
                }
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
                    cursor: this.props.areMarksClickable ? "pointer" : "default"
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
