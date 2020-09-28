// This implements the line labels that appear to the right of the lines/polygons in LineCharts/StackedAreas.
import * as React from "react"
import {
    noop,
    cloneDeep,
    max,
    min,
    sortBy,
    sumBy,
    flatten,
    sign,
} from "grapher/utils/Util"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { TextWrap } from "grapher/text/TextWrap"
import { VerticalAxis } from "grapher/axis/Axis"
import { Bounds } from "grapher/utils/Bounds"
import { AddEntityButton } from "grapher/controls/AddEntityButton"
import { ControlsOverlay } from "grapher/controls/ControlsOverlay"
import { EntityName } from "coreTable/CoreTableConstants"
import { BASE_FONT_SIZE, Color, LineName } from "grapher/core/GrapherConstants"

// Minimum vertical space between two legend items
const LEGEND_ITEM_MIN_SPACING = 2
// Horizontal distance from the end of the chart to the start of the marker
const MARKER_MARGIN = 4
// Need a constant button height which we can use in positioning calculations
const ADD_BUTTON_HEIGHT = 30

export interface LineLabelMark {
    lineName: LineName
    label: string
    color: Color
    yValue: number
    annotation?: string
    yRange?: [number, number]
}

interface SizedMark extends LineLabelMark {
    textWrap: TextWrap
    annotationTextWrap?: TextWrap
    width: number
    height: number
}

interface PlacedMark extends SizedMark {
    origBounds: Bounds
    bounds: Bounds
    isOverlap: boolean
    repositions: number
    level: number
    totalLevels: number
}

function groupBounds(group: PlacedMark[]) {
    const first = group[0]
    const last = group[group.length - 1]
    const height = last.bounds.bottom - first.bounds.top
    const width = Math.max(first.bounds.width, last.bounds.width)
    return new Bounds(first.bounds.x, first.bounds.y, width, height)
}

function stackGroupVertically(group: PlacedMark[], y: number) {
    let currentY = y
    group.forEach((mark) => {
        mark.bounds = mark.bounds.extend({ y: currentY })
        mark.repositions += 1
        currentY += mark.bounds.height + LEGEND_ITEM_MIN_SPACING
    })
    return group
}

@observer
class Label extends React.Component<{
    mark: PlacedMark
    manager: LineLegend
    isFocus?: boolean
    needsLines?: boolean
    onMouseOver: () => void
    onClick: () => void
    onMouseLeave?: () => void
}> {
    render() {
        const {
            mark,
            manager,
            isFocus,
            needsLines,
            onMouseOver,
            onMouseLeave,
            onClick,
        } = this.props
        const x = mark.origBounds.x
        const markerX1 = x + MARKER_MARGIN
        const markerX2 = x + manager.leftPadding - MARKER_MARGIN
        const step = (markerX2 - markerX1) / (mark.totalLevels + 1)
        const markerXMid = markerX1 + step + mark.level * step
        const lineColor = isFocus ? "#999" : "#eee"
        const textColor = isFocus ? mark.color : "#ddd"
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
                {mark.textWrap.render(
                    needsLines ? markerX2 + MARKER_MARGIN : markerX1,
                    mark.bounds.y,
                    { fill: textColor }
                )}
                {mark.annotationTextWrap &&
                    mark.annotationTextWrap.render(
                        needsLines ? markerX2 + MARKER_MARGIN : markerX1,
                        mark.bounds.y + mark.textWrap.height,
                        {
                            fill: annotationColor,
                            className: "textAnnotation",
                            style: { fontWeight: "lighter" },
                        }
                    )}
            </g>
        )
    }
}

export interface LineLegendManager {
    areMarksClickable?: boolean
    canAddData?: boolean
    isSelectingData?: boolean
    showAddEntityControls?: boolean
    entityType?: string
    labelMarks: LineLabelMark[]
    maxLegendWidth?: number
    fontSize?: number
    onLegendMouseOver?: (key: EntityName) => void
    onLegendClick?: (key: EntityName) => void
    onLegendMouseLeave?: () => void
    focusedLineNames: EntityName[]
    verticalAxis: VerticalAxis
    legendX?: number
}

@observer
export class LineLegend extends React.Component<{
    manager: LineLegendManager
}> {
    @computed private get fontSize() {
        return 0.75 * (this.manager.fontSize ?? BASE_FONT_SIZE)
    }
    leftPadding = 35

    @computed private get maxWidth() {
        return this.manager.maxLegendWidth ?? 300
    }

    @computed.struct get sizedLabels(): SizedMark[] {
        const { fontSize, leftPadding, maxWidth } = this
        const maxTextWidth = maxWidth - leftPadding
        const maxAnnotationWidth = Math.min(maxTextWidth, 150)

        return this.manager.labelMarks.map((label) => {
            const annotationTextWrap = label.annotation
                ? new TextWrap({
                      text: label.annotation,
                      maxWidth: maxAnnotationWidth,
                      fontSize: fontSize * 0.9,
                  })
                : undefined
            const textWrap = new TextWrap({
                text: label.label,
                maxWidth: maxTextWidth,
                fontSize,
            })
            return {
                ...label,
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
                    (annotationTextWrap ? annotationTextWrap.height : 0),
            }
        })
    }

    @computed get width() {
        if (this.sizedLabels.length === 0) return 0
        return max(this.sizedLabels.map((d) => d.width)) ?? 0
    }

    @computed get onMouseOver(): any {
        return this.manager.onLegendMouseOver ?? noop
    }
    @computed get onMouseLeave(): any {
        return this.manager.onLegendMouseLeave ?? noop
    }
    @computed get onClick(): any {
        return this.manager.onLegendClick ?? noop
    }

    @computed get isFocusMode() {
        return this.sizedLabels.some((label) =>
            this.manager.focusedLineNames.includes(label.lineName)
        )
    }

    @computed get legendX() {
        return this.manager.legendX ?? 0
    }

    // Naive initial placement of each mark at the target height, before collision detection
    @computed private get initialMarks(): PlacedMark[] {
        const { verticalAxis } = this.manager
        const { legendX } = this

        return sortBy(
            this.sizedLabels.map((label) => {
                // place vertically centered at Y value
                const initialY =
                    verticalAxis.place(label.yValue) - label.height / 2
                const origBounds = new Bounds(
                    legendX,
                    initialY,
                    label.width,
                    label.height
                )

                // ensure label doesn't go beyond the top or bottom of the chart
                const y = Math.min(
                    Math.max(initialY, verticalAxis.rangeMin),
                    verticalAxis.rangeMax - label.height
                )
                const bounds = new Bounds(legendX, y, label.width, label.height)

                return {
                    ...label,
                    y,
                    origBounds,
                    bounds,
                    isOverlap: false,
                    repositions: 0,
                    level: 0,
                    totalLevels: 0,
                }

                // Ensure list is sorted by the visual position in ascending order
            }),
            (label) => verticalAxis.place(label.yValue)
        )
    }

    @computed get standardPlacement() {
        const { verticalAxis } = this.manager

        const groups: PlacedMark[][] = cloneDeep(
            this.initialMarks
        ).map((mark) => [mark])

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
                    const overflowTop = Math.max(
                        verticalAxis.rangeMin - targetY,
                        0
                    )
                    const overflowBottom = Math.max(
                        targetY + newHeight - verticalAxis.rangeMax,
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
            const minLevel = min(group.map((mark) => mark.level)) as number
            const maxLevel = max(group.map((mark) => mark.level)) as number
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
                if (isOverlap) m2.isOverlap = true
            }
        }
        return marks
    }

    @computed get placedMarks() {
        const nonOverlappingMinHeight =
            sumBy(this.initialMarks, (mark) => mark.bounds.height) +
            this.initialMarks.length * LEGEND_ITEM_MIN_SPACING
        const availableHeight = this.manager.canAddData
            ? this.manager.verticalAxis.rangeSize - ADD_BUTTON_HEIGHT
            : this.manager.verticalAxis.rangeSize

        // Need to be careful here – the controls overlay will automatically add padding if
        // needed to fit the floating 'Add country' button, therefore decreasing the space
        // available to render the legend.
        // At a certain height, this ends up infinitely toggling between the two placement
        // modes. The overlapping placement allows the button to float without additional
        // padding, which then frees up space, causing the legend to render with
        // standardPlacement.
        // This is why we need to take into account the height of the 'Add country' button.
        if (nonOverlappingMinHeight > availableHeight)
            return this.overlappingPlacement

        return this.standardPlacement
    }

    @computed private get backgroundMarks() {
        const { focusedLineNames } = this.manager
        const { isFocusMode } = this
        return this.placedMarks.filter((mark) =>
            isFocusMode
                ? !focusedLineNames.includes(mark.lineName)
                : mark.isOverlap
        )
    }

    @computed private get focusMarks() {
        const { focusedLineNames } = this.manager
        const { isFocusMode } = this
        return this.placedMarks.filter((mark) =>
            isFocusMode
                ? focusedLineNames.includes(mark.lineName)
                : !mark.isOverlap
        )
    }

    // TODO: looks unused. Can we remove?
    @computed get numMovesNeeded() {
        return this.placedMarks.filter(
            (m) => m.isOverlap || !m.bounds.equals(m.origBounds)
        ).length
    }

    // Does this placement need line markers or is the position of the labels already clear?
    @computed private get needsLines() {
        return this.placedMarks.some((mark) => mark.totalLevels > 1)
    }

    private renderBackground() {
        return this.backgroundMarks.map((mark) => (
            <Label
                key={mark.lineName}
                mark={mark}
                manager={this}
                needsLines={this.needsLines}
                onMouseOver={() => this.onMouseOver(mark.lineName)}
                onClick={() => this.onClick(mark.lineName)}
            />
        ))
    }

    // All labels are focused by default, moved to background when mouseover of other label
    private renderFocus() {
        return this.focusMarks.map((mark) => (
            <Label
                key={mark.lineName}
                mark={mark}
                manager={this}
                isFocus={true}
                needsLines={this.needsLines}
                onMouseOver={() => this.onMouseOver(mark.lineName)}
                onClick={() => this.onClick(mark.lineName)}
                onMouseLeave={() => this.onMouseLeave(mark.lineName)}
            />
        ))
    }

    @action.bound onAddClick() {
        // Do this for mobx
        this.manager.isSelectingData = true
    }

    @computed get manager() {
        return this.props.manager
    }

    get addEntityButton() {
        if (!this.manager.showAddEntityControls) return undefined

        const verticalAlign = "bottom"

        const leftOffset = this.needsLines
            ? this.leftPadding
            : this.width > 70
            ? 21
            : 5

        const topMarkY =
            min(this.placedMarks.map((mark) => mark.bounds.top)) ?? 0

        const paddingTop = AddEntityButton.calcPaddingTop(
            topMarkY,
            verticalAlign,
            ADD_BUTTON_HEIGHT
        )

        return (
            <ControlsOverlay id="add-country" paddingTop={paddingTop}>
                <AddEntityButton
                    x={this.legendX + leftOffset}
                    y={topMarkY}
                    align="left"
                    verticalAlign={verticalAlign}
                    height={ADD_BUTTON_HEIGHT}
                    label={`Add ${this.manager.entityType ?? "Country"}`}
                    onClick={this.onAddClick}
                />
            </ControlsOverlay>
        )
    }

    render() {
        return (
            <g
                className="LineLabels"
                style={{
                    cursor: this.manager.areMarksClickable
                        ? "pointer"
                        : "default",
                }}
            >
                {this.renderBackground()}
                {this.renderFocus()}
                {this.addEntityButton}
            </g>
        )
    }
}
