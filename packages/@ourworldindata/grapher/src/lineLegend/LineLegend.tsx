// This implements the line labels that appear to the right of the lines/polygons in LineCharts/StackedAreas.
import React from "react"
import {
    Bounds,
    noop,
    cloneDeep,
    max,
    min,
    sortBy,
    sumBy,
    makeIdForHumanConsumption,
    excludeUndefined,
    sortedIndexBy,
    last,
    maxBy,
} from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { VerticalAxis } from "../axis/Axis"
import { EntityName } from "@ourworldindata/types"
import { BASE_FONT_SIZE, GRAPHER_FONT_SCALE_12 } from "../core/GrapherConstants"
import { ChartSeries } from "../chart/ChartInterface"
import { darkenColorForText } from "../color/ColorUtils"

// Minimum vertical space between two legend items
const LEGEND_ITEM_MIN_SPACING = 2
// Horizontal distance from the end of the chart to the start of the marker
const MARKER_MARGIN = 4
// Space between the label and the annotation
const ANNOTATION_PADDING = 2

const LEFT_PADDING = 35

const DEFAULT_FONT_WEIGHT = 400

export interface LineLabelSeries extends ChartSeries {
    label: string
    yValue: number
    annotation?: string
    yRange?: [number, number]
}

interface SizedSeries extends LineLabelSeries {
    textWrap: TextWrap
    annotationTextWrap?: TextWrap
    width: number
    height: number
}

interface PlacedSeries extends SizedSeries {
    origBounds: Bounds
    bounds: Bounds
    repositions: number
    level: number
    totalLevels: number
    midY: number
}

function getSeriesKey(
    series: PlacedSeries,
    index: number,
    key: string
): string {
    return `${key}-${index}-` + series.seriesName
}

function groupBounds(group: PlacedSeries[]): Bounds {
    const first = group[0]
    const last = group[group.length - 1]
    const height = last.bounds.bottom - first.bounds.top
    const width = Math.max(first.bounds.width, last.bounds.width)
    return new Bounds(first.bounds.x, first.bounds.y, width, height)
}

function stackGroupVertically(
    group: PlacedSeries[],
    y: number
): PlacedSeries[] {
    let currentY = y
    group.forEach((mark) => {
        mark.bounds = mark.bounds.set({ y: currentY })
        mark.repositions += 1
        currentY += mark.bounds.height + LEGEND_ITEM_MIN_SPACING
    })
    return group
}

@observer
class LineLabels extends React.Component<{
    series: PlacedSeries[]
    uniqueKey: string
    needsLines: boolean
    isFocus?: boolean
    isStatic?: boolean
    onClick?: (series: PlacedSeries) => void
    onMouseOver?: (series: PlacedSeries) => void
    onMouseLeave?: (series: PlacedSeries) => void
}> {
    @computed get markers(): {
        series: PlacedSeries
        labelText: { x: number; y: number }
        connectorLine: { x1: number; x2: number }
    }[] {
        return this.props.series.map((series) => {
            const { x } = series.origBounds
            const connectorLine = {
                x1: x + MARKER_MARGIN,
                x2: x + LEFT_PADDING - MARKER_MARGIN,
            }

            const textX = this.props.needsLines
                ? connectorLine.x2 + MARKER_MARGIN
                : x + MARKER_MARGIN
            const textY = series.bounds.y

            return {
                series,
                labelText: { x: textX, y: textY },
                connectorLine,
            }
        })
    }

    @computed get textOpacity(): number {
        return this.props.isFocus ? 1 : 0.6
    }

    @computed get textLabels(): React.ReactElement {
        return (
            <g id={makeIdForHumanConsumption("text-labels")}>
                {this.markers.map(({ series, labelText }, index) => {
                    const textColor = darkenColorForText(series.color)
                    return (
                        <React.Fragment
                            key={getSeriesKey(
                                series,
                                index,
                                this.props.uniqueKey
                            )}
                        >
                            {series.textWrap.render(labelText.x, labelText.y, {
                                textProps: {
                                    fill: textColor,
                                    opacity: this.textOpacity,
                                },
                            })}
                        </React.Fragment>
                    )
                })}
            </g>
        )
    }

    @computed get textAnnotations(): React.ReactElement | void {
        const markersWithAnnotations = this.markers.filter(
            ({ series }) => series.annotationTextWrap !== undefined
        )
        if (!markersWithAnnotations) return
        return (
            <g id={makeIdForHumanConsumption("text-annotations")}>
                {markersWithAnnotations.map(({ series, labelText }, index) => {
                    return (
                        <React.Fragment
                            key={getSeriesKey(
                                series,
                                index,
                                this.props.uniqueKey
                            )}
                        >
                            {series.annotationTextWrap?.render(
                                labelText.x,
                                labelText.y + series.textWrap.height,
                                {
                                    textProps: {
                                        fill: "#333",
                                        opacity: this.textOpacity,
                                        style: { fontWeight: 300 },
                                    },
                                }
                            )}
                        </React.Fragment>
                    )
                })}
            </g>
        )
    }

    @computed get connectorLines(): React.ReactElement | void {
        if (!this.props.needsLines) return
        return (
            <g id={makeIdForHumanConsumption("connectors")}>
                {this.markers.map(({ series, connectorLine }, index) => {
                    const { isFocus } = this.props
                    const { x1, x2 } = connectorLine
                    const {
                        level,
                        totalLevels,
                        origBounds: { centerY: leftCenterY },
                        bounds: { centerY: rightCenterY },
                    } = series

                    const step = (x2 - x1) / (totalLevels + 1)
                    const markerXMid = x1 + step + level * step
                    const d = `M${x1},${leftCenterY} H${markerXMid} V${rightCenterY} H${x2}`
                    const lineColor = isFocus ? "#999" : "#eee"

                    return (
                        <path
                            id={makeIdForHumanConsumption(series.seriesName)}
                            key={getSeriesKey(
                                series,
                                index,
                                this.props.uniqueKey
                            )}
                            d={d}
                            stroke={lineColor}
                            strokeWidth={0.5}
                            fill="none"
                        />
                    )
                })}
            </g>
        )
    }

    @computed get interactions(): React.ReactElement | void {
        return (
            <g>
                {this.props.series.map((series, index) => {
                    return (
                        <g
                            key={getSeriesKey(
                                series,
                                index,
                                this.props.uniqueKey
                            )}
                            onMouseOver={() => this.props.onMouseOver?.(series)}
                            onMouseLeave={() =>
                                this.props.onMouseLeave?.(series)
                            }
                            onClick={() => this.props.onClick?.(series)}
                            style={{ cursor: "default" }}
                        >
                            <rect
                                x={series.origBounds.x}
                                y={series.bounds.y}
                                width={series.bounds.width}
                                height={series.bounds.height}
                                fill="#fff"
                                opacity={0}
                            />
                        </g>
                    )
                })}
            </g>
        )
    }

    render(): React.ReactElement {
        return (
            <>
                {this.connectorLines}
                {this.textAnnotations}
                {this.textLabels}
                {!this.props.isStatic && this.interactions}
            </>
        )
    }
}

export interface LineLegendManager {
    labelSeries: LineLabelSeries[]
    maxLineLegendWidth?: number
    fontSize?: number
    fontWeight?: number
    onLineLegendMouseOver?: (key: EntityName) => void
    onLineLegendClick?: (key: EntityName) => void
    onLineLegendMouseLeave?: () => void
    focusedSeriesNames: EntityName[]
    yAxis: VerticalAxis
    lineLegendY?: [number, number]
    lineLegendX?: number
    // used to determine which series should be labelled when there is limited space
    seriesSortedByImportance?: EntityName[]
    isStatic?: boolean
}

@observer
export class LineLegend extends React.Component<{
    manager: LineLegendManager
}> {
    @computed private get fontSize(): number {
        return GRAPHER_FONT_SCALE_12 * (this.manager.fontSize ?? BASE_FONT_SIZE)
    }

    @computed private get fontWeight(): number {
        return this.manager.fontWeight ?? DEFAULT_FONT_WEIGHT
    }

    @computed private get maxWidth(): number {
        return this.manager.maxLineLegendWidth ?? 300
    }

    @computed.struct get sizedLabels(): SizedSeries[] {
        const { fontSize, fontWeight, maxWidth } = this
        const maxTextWidth = maxWidth - LEFT_PADDING
        const maxAnnotationWidth = Math.min(maxTextWidth, 150)

        return this.manager.labelSeries.map((label) => {
            const annotationTextWrap = label.annotation
                ? new TextWrap({
                      text: label.annotation,
                      maxWidth: maxAnnotationWidth,
                      fontSize: fontSize * 0.9,
                      lineHeight: 1,
                  })
                : undefined
            const textWrap = new TextWrap({
                text: label.label,
                maxWidth: maxTextWidth,
                fontSize,
                fontWeight,
                lineHeight: 1,
            })
            return {
                ...label,
                textWrap,
                annotationTextWrap,
                width:
                    LEFT_PADDING +
                    Math.max(
                        textWrap.width,
                        annotationTextWrap ? annotationTextWrap.width : 0
                    ),
                height:
                    textWrap.height +
                    (annotationTextWrap
                        ? ANNOTATION_PADDING + annotationTextWrap.height
                        : 0),
            }
        })
    }

    @computed get width(): number {
        if (this.sizedLabels.length === 0) return 0
        return max(this.sizedLabels.map((d) => d.width)) ?? 0
    }

    @computed get onMouseOver(): any {
        return this.manager.onLineLegendMouseOver ?? noop
    }
    @computed get onMouseLeave(): any {
        return this.manager.onLineLegendMouseLeave ?? noop
    }
    @computed get onClick(): any {
        return this.manager.onLineLegendClick ?? noop
    }

    @computed get isFocusMode(): boolean {
        return this.sizedLabels.some((label) =>
            this.manager.focusedSeriesNames.includes(label.seriesName)
        )
    }

    @computed get legendX(): number {
        return this.manager.lineLegendX ?? 0
    }

    @computed get legendY(): [number, number] {
        const range = this.manager.lineLegendY ?? this.manager.yAxis.range
        return [Math.min(range[1], range[0]), Math.max(range[1], range[0])]
    }

    // Naive initial placement of each mark at the target height, before collision detection
    @computed private get initialSeries(): PlacedSeries[] {
        const { yAxis } = this.manager
        const { legendX, legendY } = this

        const [legendYMin, legendYMax] = legendY

        return this.sizedLabels.map((label) => {
            // place vertically centered at Y value
            const midY = yAxis.place(label.yValue)
            const initialY = midY - label.height / 2
            const origBounds = new Bounds(
                legendX,
                initialY,
                label.width,
                label.height
            )

            // ensure label doesn't go beyond the top or bottom of the chart
            const y = Math.min(
                Math.max(initialY, legendYMin),
                legendYMax - label.height
            )
            const bounds = new Bounds(legendX, y, label.width, label.height)

            return {
                ...label,
                y,
                midY,
                origBounds,
                bounds,
                repositions: 0,
                level: 0,
                totalLevels: 0,
            }
        })
    }

    @computed get initialSeriesByName(): Map<EntityName, PlacedSeries> {
        return new Map(this.initialSeries.map((d) => [d.seriesName, d]))
    }

    @computed get placedSeries(): PlacedSeries[] {
        const [yLegendMin, yLegendMax] = this.legendY

        // ensure list is sorted by the visual position in ascending order
        const sortedSeries = sortBy(
            this.partialInitialSeries,
            (label) => label.midY
        )

        const groups: PlacedSeries[][] = cloneDeep(sortedSeries).map((mark) => [
            mark,
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
                    const overflowTop = Math.max(yLegendMin - targetY, 0)
                    const overflowBottom = Math.max(
                        targetY + newHeight - yLegendMax,
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
            for (const series of group) {
                const currentSign = Math.sign(
                    series.bounds.y - series.origBounds.y
                )
                if (prevSign === currentSign) {
                    currentLevel -= currentSign
                }
                series.level = currentLevel
                prevSign = currentSign
            }
            const minLevel = min(group.map((mark) => mark.level)) as number
            const maxLevel = max(group.map((mark) => mark.level)) as number
            for (const mark of group) {
                mark.level -= minLevel
                mark.totalLevels = maxLevel - minLevel + 1
            }
        }

        return groups.flat()
    }

    @computed get sortedSeriesByImportance(): PlacedSeries[] | undefined {
        if (!this.manager.seriesSortedByImportance) return undefined
        return excludeUndefined(
            this.manager.seriesSortedByImportance.map((seriesName) =>
                this.initialSeriesByName.get(seriesName)
            )
        )
    }

    @computed get partialInitialSeries(): PlacedSeries[] {
        const { legendY } = this
        const availableHeight = Math.abs(legendY[1] - legendY[0])
        const nonOverlappingMinHeight =
            sumBy(this.initialSeries, (series) => series.bounds.height) +
            this.initialSeries.length * LEGEND_ITEM_MIN_SPACING

        // early return if filtering is not needed
        if (nonOverlappingMinHeight <= availableHeight)
            return this.initialSeries

        if (this.sortedSeriesByImportance) {
            // keep a subset of series that fit within the available height,
            // prioritizing by importance. Note that more important (but longer)
            // series names are skipped if they don't fit.
            const keepSeries: PlacedSeries[] = []
            let keepSeriesHeight = 0
            for (const series of this.sortedSeriesByImportance) {
                const newHeight =
                    keepSeriesHeight +
                    series.bounds.height +
                    LEGEND_ITEM_MIN_SPACING
                if (newHeight <= availableHeight) {
                    keepSeries.push(series)
                    keepSeriesHeight = newHeight
                    if (keepSeriesHeight > availableHeight) break
                }
            }
            return keepSeries
        } else {
            const candidates = new Set<PlacedSeries>(this.initialSeries)
            const sortedKeepSeries: PlacedSeries[] = []

            let keepSeriesHeight = 0

            const maybePickCandidate = (candidate: PlacedSeries): boolean => {
                const newHeight =
                    keepSeriesHeight +
                    candidate.bounds.height +
                    LEGEND_ITEM_MIN_SPACING
                if (newHeight <= availableHeight) {
                    const insertIndex = sortedIndexBy(
                        sortedKeepSeries,
                        candidate,
                        (s) => s.midY
                    )
                    sortedKeepSeries.splice(insertIndex, 0, candidate)
                    candidates.delete(candidate)
                    keepSeriesHeight = newHeight
                    return true
                }
                return false
            }

            type Bracket = [number, number]
            const findBracket = (
                sortedBrackets: Bracket[],
                n: number
            ): [number | undefined, number | undefined] => {
                if (sortedBrackets.length === 0) return [undefined, undefined]

                const firstBracketValue = sortedBrackets[0][0]
                const lastBracketValue = last(sortedBrackets)![1]

                if (n < firstBracketValue) return [undefined, firstBracketValue]
                if (n >= lastBracketValue) return [lastBracketValue, undefined]

                for (const bracket of sortedBrackets) {
                    if (n >= bracket[0] && n < bracket[1]) return bracket
                }

                return [undefined, undefined]
            }

            const sortedCandidates = sortBy(this.initialSeries, (c) => c.midY)

            // pick two candidates, one from the top and one from the bottom
            const midIndex = Math.floor((sortedCandidates.length - 1) / 2)
            for (let startIndex = 0; startIndex <= midIndex; startIndex++) {
                const endIndex = sortedCandidates.length - 1 - startIndex
                maybePickCandidate(sortedCandidates[endIndex])
                if (sortedKeepSeries.length >= 2 || startIndex === endIndex)
                    break
                maybePickCandidate(sortedCandidates[startIndex])
                if (sortedKeepSeries.length >= 2) break
            }

            while (candidates.size > 0 && keepSeriesHeight <= availableHeight) {
                const sortedBrackets = sortedKeepSeries
                    .slice(0, -1)
                    .map((s, i) => [s.midY, sortedKeepSeries[i + 1].midY])
                    .filter((bracket) => bracket[0] !== bracket[1]) as Bracket[]

                // score each candidate based on how well it fits into the available space
                const candidateScores: [PlacedSeries, number][] = Array.from(
                    candidates
                ).map((candidate) => {
                    // find the bracket that the candidate is contained in
                    const [start, end] = findBracket(
                        sortedBrackets,
                        candidate.midY
                    )
                    // if no bracket is found, return the worst possible score
                    if (end === undefined || start === undefined)
                        return [candidate, 0]

                    // score the candidate based on how far it is from the
                    // middle of the bracket and how large the bracket is
                    const length = end - start
                    const midPoint = start + length / 2
                    const distanceFromMidPoint = Math.abs(
                        candidate.midY - midPoint
                    )
                    const score = length - distanceFromMidPoint

                    return [candidate, score]
                })

                // pick the candidate with the highest score
                // that fits into the available space
                let picked = false
                while (!picked && candidateScores.length > 0) {
                    const maxCandidateArr = maxBy(candidateScores, (s) => s[1])!
                    const maxCandidate = maxCandidateArr[0]
                    picked = maybePickCandidate(maxCandidate)

                    // if the highest scoring candidate doesn't fit,
                    // remove it from the candidates and continue
                    if (!picked) {
                        candidates.delete(maxCandidate)

                        const cIndex = candidateScores.indexOf(maxCandidateArr)
                        if (cIndex > -1) candidateScores.splice(cIndex, 1)
                    }
                }
            }

            return sortedKeepSeries
        }
    }

    @computed private get backgroundSeries(): PlacedSeries[] {
        const { focusedSeriesNames } = this.manager
        const { isFocusMode } = this
        return this.placedSeries.filter(
            (mark) =>
                isFocusMode && !focusedSeriesNames.includes(mark.seriesName)
        )
    }

    @computed private get focusedSeries(): PlacedSeries[] {
        const { focusedSeriesNames } = this.manager
        const { isFocusMode } = this
        return this.placedSeries.filter(
            (mark) =>
                !isFocusMode || focusedSeriesNames.includes(mark.seriesName)
        )
    }

    // Does this placement need line markers or is the position of the labels already clear?
    @computed private get needsLines(): boolean {
        return this.placedSeries.some((series) => series.totalLevels > 1)
    }

    private renderBackground(): React.ReactElement {
        return (
            <LineLabels
                uniqueKey="background"
                series={this.backgroundSeries}
                needsLines={this.needsLines}
                isFocus={false}
                isStatic={this.manager.isStatic}
                onMouseOver={(series): void =>
                    this.onMouseOver(series.seriesName)
                }
                onClick={(series): void => this.onClick(series.seriesName)}
            />
        )
    }

    // All labels are focused by default, moved to background when mouseover of other label
    private renderFocus(): React.ReactElement {
        return (
            <LineLabels
                uniqueKey="focus"
                series={this.focusedSeries}
                needsLines={this.needsLines}
                isFocus={true}
                isStatic={this.manager.isStatic}
                onMouseOver={(series): void =>
                    this.onMouseOver(series.seriesName)
                }
                onClick={(series): void => this.onClick(series.seriesName)}
                onMouseLeave={(series): void =>
                    this.onMouseLeave(series.seriesName)
                }
            />
        )
    }

    @computed get manager(): LineLegendManager {
        return this.props.manager
    }

    render(): React.ReactElement {
        return (
            <g
                id={makeIdForHumanConsumption("line-labels")}
                className="LineLabels"
            >
                {this.renderBackground()}
                {this.renderFocus()}
            </g>
        )
    }
}
