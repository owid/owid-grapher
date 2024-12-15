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
    partition,
} from "@ourworldindata/utils"
import { TextWrap, TextWrapGroup, Halo } from "@ourworldindata/components"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { VerticalAxis } from "../axis/Axis"
import {
    Color,
    EntityName,
    InteractionState,
    SeriesName,
    VerticalAlign,
} from "@ourworldindata/types"
import { BASE_FONT_SIZE, GRAPHER_FONT_SCALE_12 } from "../core/GrapherConstants"
import { ChartSeries } from "../chart/ChartInterface"
import { darkenColorForText } from "../color/ColorUtils"
import { AxisConfig } from "../axis/AxisConfig.js"
import {
    GRAPHER_BACKGROUND_DEFAULT,
    GRAY_30,
    GRAY_70,
} from "../color/ColorConstants"

// text color for labels of background series
const NON_FOCUSED_TEXT_COLOR = GRAY_70
// Minimum vertical space between two legend items
export const LEGEND_ITEM_MIN_SPACING = 4
// Horizontal distance from the end of the chart to the start of the marker
const MARKER_MARGIN = 4
// Space between the label and the annotation
const ANNOTATION_PADDING = 1

const DEFAULT_CONNECTOR_LINE_WIDTH = 25
const DEFAULT_FONT_WEIGHT = 400

export interface LineLabelSeries extends ChartSeries {
    label: string
    yValue: number
    annotation?: string
    formattedValue?: string
    placeFormattedValueInNewLine?: boolean
    yRange?: [number, number]
    hover?: InteractionState
    focus?: InteractionState
}

interface SizedSeries extends LineLabelSeries {
    textWrap: TextWrap | TextWrapGroup
    annotationTextWrap?: TextWrap
    width: number
    height: number
    fontWeight?: number
}

interface PlacedSeries extends SizedSeries {
    origBounds: Bounds
    bounds: Bounds
    repositions: number
    level: number
    totalLevels: number
    midY: number
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
    needsConnectorLines: boolean
    showTextOutline?: boolean
    textOutlineColor?: Color
    anchor?: "start" | "end"
    isStatic?: boolean
    cursor?: string
    onClick?: (series: PlacedSeries) => void
    onMouseOver?: (series: PlacedSeries) => void
    onMouseLeave?: (series: PlacedSeries) => void
}> {
    @computed private get anchor(): "start" | "end" {
        return this.props.anchor ?? "start"
    }

    @computed private get showTextOutline(): boolean {
        return this.props.showTextOutline ?? false
    }

    @computed private get textOutlineColor(): Color {
        return this.props.textOutlineColor ?? GRAPHER_BACKGROUND_DEFAULT
    }

    private textOpacityForSeries(series: PlacedSeries): number {
        return series.hover?.background && !series.focus?.background ? 0.6 : 1
    }

    @computed private get markers(): {
        series: PlacedSeries
        labelText: { x: number; y: number }
        connectorLine: { x1: number; x2: number }
    }[] {
        return this.props.series.map((series) => {
            const direction = this.anchor === "start" ? 1 : -1
            const markerMargin = direction * MARKER_MARGIN
            const connectorLineWidth = direction * DEFAULT_CONNECTOR_LINE_WIDTH

            const { x } = series.origBounds
            const connectorLine = {
                x1: x + markerMargin,
                x2: x + connectorLineWidth - markerMargin,
            }

            const textX = this.props.needsConnectorLines
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
                {this.markers.map(({ series, labelText }) => {
                    const textColor =
                        !series.focus?.background || series.hover?.active
                            ? darkenColorForText(series.color)
                            : NON_FOCUSED_TEXT_COLOR
                    const textProps = {
                        fill: textColor,
                        opacity: this.textOpacityForSeries(series),
                        textAnchor: this.anchor,
                    }

                    return series.textWrap instanceof TextWrap ? (
                        <Halo
                            id={series.seriesName}
                            key={series.seriesName}
                            show={this.showTextOutline}
                            outlineColor={this.textOutlineColor}
                        >
                            {series.textWrap.render(labelText.x, labelText.y, {
                                textProps: {
                                    ...textProps,
                                    // might override the textWrap's fontWeight
                                    fontWeight: series.fontWeight,
                                },
                            })}
                        </Halo>
                    ) : (
                        <React.Fragment key={series.seriesName}>
                            {series.textWrap.render(labelText.x, labelText.y, {
                                showTextOutline: this.showTextOutline,
                                textOutlineColor: this.textOutlineColor,
                                textProps,
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
                {markersWithAnnotations.map(({ series, labelText }) => {
                    if (!series.annotationTextWrap) return
                    return (
                        <Halo
                            id={series.seriesName}
                            key={series.seriesName}
                            show={this.showTextOutline}
                            outlineColor={this.textOutlineColor}
                        >
                            {series.annotationTextWrap.render(
                                labelText.x,
                                labelText.y +
                                    series.textWrap.height +
                                    ANNOTATION_PADDING,
                                {
                                    textProps: {
                                        fill: "#333",
                                        opacity:
                                            this.textOpacityForSeries(series),
                                        textAnchor: this.anchor,
                                        style: { fontWeight: 300 },
                                    },
                                }
                            )}
                        </Halo>
                    )
                })}
            </g>
        )
    }

    @computed private get connectorLines(): React.ReactElement | void {
        if (!this.props.needsConnectorLines) return
        return (
            <g id={makeIdForHumanConsumption("connectors")}>
                {this.markers.map(({ series, connectorLine }) => {
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
                    const lineColor = series.hover?.background
                        ? "#eee"
                        : series.focus?.background
                          ? GRAY_30
                          : "#999"

                    return (
                        <path
                            id={makeIdForHumanConsumption(series.seriesName)}
                            key={series.seriesName}
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
                {this.props.series.map((series) => {
                    const x =
                        this.anchor === "start"
                            ? series.origBounds.x
                            : series.origBounds.x - series.bounds.width
                    return (
                        <g
                            key={series.seriesName}
                            onMouseOver={() => this.props.onMouseOver?.(series)}
                            onMouseLeave={() =>
                                this.props.onMouseLeave?.(series)
                            }
                            onClick={() => this.props.onClick?.(series)}
                            style={{ cursor: this.props.cursor }}
                        >
                            <rect
                                x={x}
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
    series: LineLabelSeries[]
    yAxis?: VerticalAxis

    // positioning
    x?: number
    yRange?: [number, number]
    maxWidth?: number
    xAnchor?: "start" | "end"
    verticalAlign?: VerticalAlign

    // presentation
    fontSize?: number
    fontWeight?: number
    showTextOutlines?: boolean
    textOutlineColor?: Color

    // used to determine which series should be labelled when there is limited space
    seriesNamesSortedByImportance?: SeriesName[]

    // interactions
    isStatic?: boolean // don't add interactions if true
    onClick?: (key: SeriesName) => void
    onMouseOver?: (key: SeriesName) => void
    onMouseLeave?: () => void
}

@observer
export class LineLegend extends React.Component<LineLegendProps> {
    /**
     * Larger than the actual width since the width of the connector lines
     * is always added, even if they're not rendered.
     *
     * This is partly due to a circular dependency (in line and stacked area
     * charts), partly to avoid jumpy layout changes (slope charts).
     */
    static stableWidth(props: LineLegendProps): number {
        const test = new LineLegend(props)
        return test.stableWidth
    }

    static width(props: LineLegendProps): number {
        const test = new LineLegend(props)
        return test.width
    }

    static fontSize(props: Partial<LineLegendProps>): number {
        const test = new LineLegend(props as LineLegendProps)
        return test.fontSize
    }

    static maxLevel(props: Partial<LineLegendProps>): number {
        const test = new LineLegend(props as LineLegendProps)
        return test.maxLevel
    }

    static visibleSeriesNames(props: LineLegendProps): SeriesName[] {
        const test = new LineLegend(props as LineLegendProps)
        return test.visibleSeriesNames
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

    @computed private get verticalAlign(): VerticalAlign {
        return this.props.verticalAlign ?? VerticalAlign.middle
    }

    @computed private get textMaxWidth(): number {
        return this.maxWidth - DEFAULT_CONNECTOR_LINE_WIDTH
    }

    private makeLabelTextWrap(
        series: LineLabelSeries
    ): TextWrap | TextWrapGroup {
        if (!series.formattedValue) {
            return new TextWrap({
                text: series.label,
                maxWidth: this.textMaxWidth,
                fontSize: this.fontSize,
                // using the actual font weight here would lead to a jumpy layout
                // when focusing/unfocusing a series since focused series are
                // bolded and the computed text width depends on the text's font weight.
                // that's why we always use bold labels to comupte the layout,
                // but might render them later using a regular font weight.
                fontWeight: 700,
            })
        }

        // text label fragment
        const textLabel = { text: series.label, fontWeight: 700 }

        // value label fragment
        const newLine = series.placeFormattedValueInNewLine
            ? "always"
            : "avoid-wrap"
        const valueLabel = {
            text: series.formattedValue,
            fontWeight: 400,
            newLine,
        }

        return new TextWrapGroup({
            fragments: [textLabel, valueLabel],
            maxWidth: this.textMaxWidth,
            fontSize: this.fontSize,
        })
    }

    private makeAnnotationTextWrap(
        series: LineLabelSeries
    ): TextWrap | undefined {
        if (!series.annotation) return undefined
        const maxWidth = Math.min(this.textMaxWidth, 150)
        return new TextWrap({
            text: series.annotation,
            maxWidth,
            fontSize: this.fontSize * 0.9,
            lineHeight: 1,
        })
    }

    @computed.struct get sizedSeries(): SizedSeries[] {
        const { fontWeight: globalFontWeight } = this
        return this.props.series.map((series) => {
            const textWrap = this.makeLabelTextWrap(series)
            const annotationTextWrap = this.makeAnnotationTextWrap(series)

            const annotationWidth = annotationTextWrap?.width ?? 0
            const annotationHeight = annotationTextWrap
                ? ANNOTATION_PADDING + annotationTextWrap.height
                : 0

            // font weight priority:
            // series focus state > presense of value label > globally set font weight
            const activeFontWeight = series.focus?.active ? 700 : undefined
            const seriesFontWeight = series.formattedValue ? 700 : undefined
            const fontWeight =
                activeFontWeight ?? seriesFontWeight ?? globalFontWeight

            return {
                ...series,
                textWrap,
                annotationTextWrap,
                width: Math.max(textWrap.width, annotationWidth),
                height: textWrap.height + annotationHeight,
                fontWeight,
            }
        })
    }

    @computed private get maxLabelWidth(): number {
        const { sizedSeries = [] } = this
        return max(sizedSeries.map((d) => d.width)) ?? 0
    }

    @computed get stableWidth(): number {
        return this.maxLabelWidth + DEFAULT_CONNECTOR_LINE_WIDTH + MARKER_MARGIN
    }

    @computed get width(): number {
        return this.needsLines
            ? this.stableWidth
            : this.maxLabelWidth + MARKER_MARGIN
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

    @computed get legendX(): number {
        return this.props.x ?? 0
    }

    @computed get legendY(): [number, number] {
        const range = this.props.yRange ?? this.yAxis.range
        return [Math.min(range[1], range[0]), Math.max(range[1], range[0])]
    }

    private getYPositionForSeriesLabel(series: SizedSeries): number {
        const y = this.yAxis.place(series.yValue)
        const lineHeight = series.textWrap.singleLineHeight
        switch (this.verticalAlign) {
            case VerticalAlign.middle:
                return y - series.height / 2
            case VerticalAlign.top:
                return y - lineHeight / 2
            case VerticalAlign.bottom:
                return y - series.height + lineHeight / 2
        }
    }

    // Naive initial placement of each mark at the target height, before collision detection
    @computed private get initialPlacedSeries(): PlacedSeries[] {
        const { yAxis, legendX, legendY } = this

        const [legendYMin, legendYMax] = legendY

        return this.sizedSeries.map((series) => {
            const labelHeight = series.height
            const labelWidth = series.width + DEFAULT_CONNECTOR_LINE_WIDTH

            const midY = yAxis.place(series.yValue)
            const origBounds = new Bounds(
                legendX,
                midY - series.height / 2,
                labelWidth,
                labelHeight
            )

            // ensure label doesn't go beyond the top or bottom of the chart
            const initialY = this.getYPositionForSeriesLabel(series)
            const y = Math.min(
                Math.max(initialY, legendYMin),
                legendYMax - labelHeight
            )
            const bounds = new Bounds(legendX, y, labelWidth, labelHeight)

            return {
                ...series,
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

    @computed get initialPlacedSeriesByName(): Map<EntityName, PlacedSeries> {
        return new Map(this.initialPlacedSeries.map((d) => [d.seriesName, d]))
    }

    @computed get placedSeries(): PlacedSeries[] {
        const [yLegendMin, yLegendMax] = this.legendY

        // ensure list is sorted by the visual position in ascending order
        const sortedSeries = sortBy(
            this.visiblePlacedSeries,
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

    @computed get seriesSortedByImportance(): PlacedSeries[] | undefined {
        if (!this.props.seriesNamesSortedByImportance) return undefined
        return excludeUndefined(
            this.props.seriesNamesSortedByImportance.map((seriesName) =>
                this.initialPlacedSeriesByName.get(seriesName)
            )
        )
    }

    private computeHeight(series: PlacedSeries[]): number {
        return (
            sumBy(series, (series) => series.bounds.height) +
            (series.length - 1) * LEGEND_ITEM_MIN_SPACING
        )
    }

    @computed get visiblePlacedSeries(): PlacedSeries[] {
        const { legendY } = this
        const availableHeight = Math.abs(legendY[1] - legendY[0])
        const nonOverlappingMinHeight = this.computeHeight(
            this.initialPlacedSeries
        )

        // early return if filtering is not needed
        if (nonOverlappingMinHeight <= availableHeight)
            return this.initialPlacedSeries

        if (this.seriesSortedByImportance) {
            // keep a subset of series that fit within the available height,
            // prioritizing by importance. Note that more important (but longer)
            // series names are skipped if they don't fit.
            const keepSeries: PlacedSeries[] = []
            let keepSeriesHeight = 0
            for (const series of this.seriesSortedByImportance) {
                // if the candidate is the first one, don't add padding
                const padding =
                    keepSeries.length === 0 ? 0 : LEGEND_ITEM_MIN_SPACING
                const newHeight =
                    keepSeriesHeight + series.bounds.height + padding
                if (newHeight <= availableHeight) {
                    keepSeries.push(series)
                    keepSeriesHeight = newHeight
                    if (keepSeriesHeight > availableHeight) break
                }
            }
            return keepSeries
        } else {
            const candidates = new Set<PlacedSeries>(this.initialPlacedSeries)
            const sortedKeepSeries: PlacedSeries[] = []

            let keepSeriesHeight = 0

            const maybePickCandidate = (candidate: PlacedSeries): boolean => {
                // if the candidate is the first one, don't add padding
                const padding =
                    sortedKeepSeries.length === 0 ? 0 : LEGEND_ITEM_MIN_SPACING
                const newHeight =
                    keepSeriesHeight + candidate.bounds.height + padding
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

            const [focusedCandidates, nonFocusedCandidates] = partition(
                this.initialPlacedSeries,
                (series) => series.focus?.active
            )

            // pick focused canidates first
            while (focusedCandidates.length > 0) {
                const focusedCandidate = focusedCandidates.pop()!
                const picked = maybePickCandidate(focusedCandidate)

                // if one of the focused candidates doesn't fit,
                // remove it from the candidates and continue
                if (!picked) candidates.delete(focusedCandidate)
            }

            // we initially need to pick at least two candidates.
            // - if we already picked two from the set of focused series,
            //   we're done
            // - if we picked only one focused series, then we pick another
            //   one from the set of non-focused series. we pick the one that
            //   is furthest away from the focused one
            // - if we haven't picked any focused series, we pick two from
            //   the non-focused series, one from the top and one from the bottom
            if (sortedKeepSeries.length === 0) {
                // sort the remaining candidates by their position
                const sortedCandidates = sortBy(
                    nonFocusedCandidates,
                    (c) => c.midY
                )

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
            } else if (sortedKeepSeries.length === 1) {
                const keepMidY = sortedKeepSeries[0].midY

                while (nonFocusedCandidates.length > 0) {
                    // prefer the candidate that is furthest away from the one
                    // that was already picked
                    const candidate = maxBy(nonFocusedCandidates, (c) =>
                        Math.abs(c.midY - keepMidY)
                    )!
                    const cIndex = nonFocusedCandidates.indexOf(candidate)
                    if (cIndex > -1) nonFocusedCandidates.splice(cIndex, 1)

                    // we only need one more candidate, so if we find one, we're done
                    const picked = maybePickCandidate(candidate)
                    if (picked) break

                    // if the candidate wasn't picked, remove it from the
                    // candidates and continue
                    candidates.delete(candidate)
                }
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

    @computed get visibleSeriesNames(): SeriesName[] {
        return this.visiblePlacedSeries.map((series) => series.seriesName)
    }

    @computed get visibleSeriesHeight(): number {
        return this.computeHeight(this.visiblePlacedSeries)
    }

    // Does this placement need line markers or is the position of the labels already clear?
    @computed private get needsLines(): boolean {
        return this.placedSeries.some((series) => series.totalLevels > 1)
    }

    @computed private get maxLevel(): number {
        return max(this.placedSeries.map((series) => series.totalLevels)) ?? 0
    }

    render(): React.ReactElement {
        return (
            <g
                id={makeIdForHumanConsumption("line-labels")}
                className="LineLabels"
            >
                <LineLabels
                    series={this.placedSeries}
                    needsConnectorLines={this.needsLines}
                    showTextOutline={this.props.showTextOutlines}
                    textOutlineColor={this.props.textOutlineColor}
                    anchor={this.props.xAnchor}
                    isStatic={this.props.isStatic}
                    onMouseOver={(series): void =>
                        this.onMouseOver(series.seriesName)
                    }
                    onClick={(series): void => this.onClick(series.seriesName)}
                    onMouseLeave={(series): void =>
                        this.onMouseLeave(series.seriesName)
                    }
                    cursor={this.props.onClick ? "pointer" : "default"}
                />
            </g>
        )
    }
}
