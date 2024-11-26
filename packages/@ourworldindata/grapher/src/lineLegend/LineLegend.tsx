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
import { AxisConfig } from "../axis/AxisConfig.js"

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
    anchor?: "start" | "end"
    isFocus?: boolean
    isStatic?: boolean
    onClick?: (series: PlacedSeries) => void
    onMouseOver?: (series: PlacedSeries) => void
    onMouseLeave?: (series: PlacedSeries) => void
}> {
    @computed private get textOpacity(): number {
        return this.props.isFocus ? 1 : 0.6
    }

    @computed private get anchor(): "start" | "end" {
        return this.props.anchor ?? "start"
    }

    @computed private get markers(): {
        series: PlacedSeries
        labelText: { x: number; y: number }
        connectorLine: { x1: number; x2: number }
    }[] {
        return this.props.series.map((series) => {
            const markerMargin =
                this.anchor === "start" ? MARKER_MARGIN : -MARKER_MARGIN
            const leftPadding =
                this.anchor === "start" ? LEFT_PADDING : -LEFT_PADDING

            const { x } = series.origBounds
            const connectorLine = {
                x1: x + markerMargin,
                x2: x + leftPadding - markerMargin,
            }

            const textX = this.props.needsLines
                ? connectorLine.x2 + markerMargin
                : x + markerMargin
            const textY = series.bounds.y

            return {
                series,
                labelText: { x: textX, y: textY },
                connectorLine,
            }
        })
    }

    @computed private get textLabels(): React.ReactElement {
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
                                    textAnchor: this.anchor,
                                },
                            })}
                        </React.Fragment>
                    )
                })}
            </g>
        )
    }

    @computed private get textAnnotations(): React.ReactElement | void {
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
                                        textAnchor: this.anchor,
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

    @computed private get connectorLines(): React.ReactElement | void {
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

    @computed private get interactions(): React.ReactElement | void {
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
                                x={series.origBounds.x - series.bounds.width}
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

export interface LineLegendProps {
    labelSeries: LineLabelSeries[]
    yAxis?: VerticalAxis

    // positioning
    x?: number
    yRange?: [number, number]
    maxWidth?: number
    lineLegendAnchorX?: "start" | "end"

    // presentation
    fontSize?: number
    fontWeight?: number

    // used to determine which series should be labelled when there is limited space
    seriesSortedByImportance?: EntityName[]

    // interactions
    isStatic?: boolean // don't add interactions if true
    focusedSeriesNames?: EntityName[] // currently in focus
    onClick?: (key: EntityName) => void
    onMouseOver?: (key: EntityName) => void
    onMouseLeave?: () => void
}

@observer
export class LineLegend extends React.Component<LineLegendProps> {
    static width(props: LineLegendProps): number {
        const test = new LineLegend(props)
        if (test.sizedLabels.length === 0) return 0
        return max(test.sizedLabels.map((d) => d.width)) ?? 0
    }

    @computed private get fontSize(): number {
        return GRAPHER_FONT_SCALE_12 * (this.props.fontSize ?? BASE_FONT_SIZE)
    }

    @computed private get fontWeight(): number {
        return this.props.fontWeight ?? DEFAULT_FONT_WEIGHT
    }

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? 300
    }

    @computed private get yAxis(): VerticalAxis {
        return this.props.yAxis ?? new VerticalAxis(new AxisConfig())
    }

    @computed.struct get sizedLabels(): SizedSeries[] {
        const { fontSize, fontWeight, maxWidth } = this
        const maxTextWidth = maxWidth - LEFT_PADDING
        const maxAnnotationWidth = Math.min(maxTextWidth, 150)

        return this.props.labelSeries.map((label) => {
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
        return this.props.onMouseOver ?? noop
    }
    @computed get onMouseLeave(): any {
        return this.props.onMouseLeave ?? noop
    }
    @computed get onClick(): any {
        return this.props.onClick ?? noop
    }

    @computed get focusedSeriesNames(): EntityName[] {
        return this.props.focusedSeriesNames ?? []
    }

    @computed get isFocusMode(): boolean {
        return this.sizedLabels.some((label) =>
            this.focusedSeriesNames.includes(label.seriesName)
        )
    }

    @computed get legendX(): number {
        return this.props.x ?? 0
    }

    @computed get legendY(): [number, number] {
        const range = this.props.yRange ?? this.yAxis.range
        return [Math.min(range[1], range[0]), Math.max(range[1], range[0])]
    }

    // Naive initial placement of each mark at the target height, before collision detection
    @computed private get initialSeries(): PlacedSeries[] {
        const { yAxis, legendX, legendY } = this

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
        if (!this.props.seriesSortedByImportance) return undefined
        return excludeUndefined(
            this.props.seriesSortedByImportance.map((seriesName) =>
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
        const { focusedSeriesNames } = this
        const { isFocusMode } = this
        return this.placedSeries.filter(
            (mark) =>
                isFocusMode && !focusedSeriesNames.includes(mark.seriesName)
        )
    }

    @computed private get focusedSeries(): PlacedSeries[] {
        const { focusedSeriesNames } = this
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
                anchor={this.props.lineLegendAnchorX}
                isStatic={this.props.isStatic}
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
                anchor={this.props.lineLegendAnchorX}
                isStatic={this.props.isStatic}
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
