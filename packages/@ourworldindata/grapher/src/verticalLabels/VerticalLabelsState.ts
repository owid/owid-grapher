import * as _ from "lodash-es"
import { Bounds, excludeUndefined, RequiredBy } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState.js"
import { computed } from "mobx"
import { VerticalAxis } from "../axis/Axis.js"
import { EntityName, SeriesName, VerticalAlign } from "@ourworldindata/types"
import {
    BASE_FONT_SIZE,
    GRAPHER_FONT_SCALE_12,
    GRAPHER_OPACITY_MUTE,
} from "../core/GrapherConstants.js"
import { AxisConfig } from "../axis/AxisConfig.js"
import {
    findImportantSeriesThatFitIntoTheAvailableSpace,
    findSeriesThatFitIntoTheAvailableSpace,
} from "./VerticalLabelsFilterAlgorithms.js"
import {
    ANNOTATION_PADDING,
    DEFAULT_CONNECTOR_LINE_WIDTH,
    DEFAULT_FONT_WEIGHT,
    LEGEND_ITEM_MIN_SPACING,
    MARKER_MARGIN,
} from "./VerticalLabelsConstants.js"
import {
    LabelSeries,
    PlacedLabelSeries,
    SizedLabelSeries,
    RenderLabelSeries,
} from "./VerticalLabelsTypes"

export interface VerticalLabelsStateOptions {
    yAxis?: () => VerticalAxis // Passed as getter to avoid MobX dependency cycles
    yRange?: () => [number, number] // Passed as getter to avoid MobX dependency cycles
    maxWidth?: number
    fontSize?: number
    fontWeight?: number
    verticalAlign?: VerticalAlign
    textAnchor?: "start" | "end"
    showRegionTooltip?: boolean
    seriesNamesSortedByImportance?: SeriesName[]
}

/**
 * Manages layout and visibility of vertical series labels, handling sizing,
 * placement, collision resolution, and filtering when space is limited
 */
export class VerticalLabelsState {
    private initialSeries: LabelSeries[]
    private initialOptions: VerticalLabelsStateOptions

    private defaultOptions = {
        fontSize: BASE_FONT_SIZE,
        fontWeight: DEFAULT_FONT_WEIGHT,
        maxWidth: Infinity,
        verticalAlign: VerticalAlign.middle,
        textAnchor: "start",
        showRegionTooltip: true,
    } as const satisfies Partial<VerticalLabelsStateOptions>

    constructor(series: LabelSeries[], options: VerticalLabelsStateOptions) {
        this.initialSeries = series
        this.initialOptions = options
    }

    @computed private get options(): RequiredBy<
        VerticalLabelsStateOptions,
        keyof typeof this.defaultOptions
    > {
        return { ...this.defaultOptions, ...this.initialOptions }
    }

    @computed get textAnchor(): "start" | "end" {
        return this.options.textAnchor
    }

    @computed get fontSize(): number {
        return Math.floor(GRAPHER_FONT_SCALE_12 * this.options.fontSize)
    }

    @computed private get yAxis(): VerticalAxis {
        return this.options.yAxis?.() ?? new VerticalAxis(new AxisConfig())
    }

    @computed private get textMaxWidth(): number {
        return this.options.maxWidth - DEFAULT_CONNECTOR_LINE_WIDTH
    }

    private makeAnnotationTextWrap(series: LabelSeries): TextWrap | undefined {
        if (!series.annotation) return undefined
        const maxWidth = Math.min(this.textMaxWidth, 150)
        return new TextWrap({
            text: series.annotation,
            maxWidth,
            fontSize: this.fontSize * 0.9,
            lineHeight: 1,
        })
    }

    @computed.struct get sizedSeries(): SizedLabelSeries[] {
        const { fontWeight: globalFontWeight } = this.options
        return this.initialSeries.map((series) => {
            const activeFontWeight = series.focus?.active ? 700 : undefined
            const seriesFontWeight = series.formattedValue ? 700 : undefined

            // Font weight priority:
            // Series focus state > Presence of value label > Globally set font weight
            const fontWeight =
                activeFontWeight ?? seriesFontWeight ?? globalFontWeight

            const seriesLabel = new SeriesLabelState({
                text: series.label,
                maxWidth: this.textMaxWidth,
                fontSize: this.fontSize,
                fontWeight,
                textAnchor: this.options.textAnchor,
                formattedValue: series.formattedValue,
                placeFormattedValueInNewLine:
                    series.placeFormattedValueInNewLine,
                showRegionTooltip: this.options.showRegionTooltip,
            })

            const annotationTextWrap = this.makeAnnotationTextWrap(series)
            const annotationWidth = annotationTextWrap?.width ?? 0
            const annotationHeight = annotationTextWrap
                ? ANNOTATION_PADDING + annotationTextWrap.height
                : 0

            return {
                ...series,
                seriesLabel,
                annotationTextWrap,
                width: Math.max(seriesLabel.width, annotationWidth),
                height: seriesLabel.height + annotationHeight,
            }
        })
    }

    @computed private get maxLabelWidth(): number {
        const { sizedSeries = [] } = this
        return _.max(sizedSeries.map((d) => d.width)) ?? 0
    }

    /**
     * Stable width that might be slightly inaccurate because it always
     * includes space for connector lines. This is useful to prevent layout
     * shifts when connector lines toggle on/off, and avoids circular
     * dependencies in layout calculations
     */
    @computed get stableWidth(): number {
        return this.maxLabelWidth + DEFAULT_CONNECTOR_LINE_WIDTH + MARKER_MARGIN
    }

    @computed get width(): number {
        return this.needsConnectorLines
            ? this.stableWidth
            : this.maxLabelWidth + MARKER_MARGIN
    }

    @computed private get legendY(): [number, number] {
        const range = this.options.yRange?.() ?? this.yAxis.range
        return [Math.min(range[1], range[0]), Math.max(range[1], range[0])]
    }

    private getYPositionForSeriesLabel(series: SizedLabelSeries): number {
        const y = this.yAxis.place(series.yValue)
        const lineHeight = series.seriesLabel.singleLineHeight
        switch (this.options.verticalAlign) {
            case VerticalAlign.middle:
                return y - series.height / 2
            case VerticalAlign.top:
                return y - lineHeight / 2
            case VerticalAlign.bottom:
                return y - series.height + lineHeight / 2
        }
    }

    // Naive initial placement of each mark at the target height, before collision detection
    @computed
    private get initialPlacedSeries(): PlacedLabelSeries[] {
        const { yAxis, legendY } = this
        const legendX = 0

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

    @computed get initialPlacedSeriesByName(): Map<
        EntityName,
        PlacedLabelSeries
    > {
        return new Map(this.initialPlacedSeries.map((d) => [d.seriesName, d]))
    }

    @computed get placedSeries(): PlacedLabelSeries[] {
        const [yLegendMin, yLegendMax] = this.legendY

        // ensure list is sorted by the visual position in ascending order
        const sortedSeries = _.sortBy(
            this.visiblePlacedSeries,
            (label) => label.midY
        )

        const groups: PlacedLabelSeries[][] = sortedSeries.map((mark) => [
            { ...mark },
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
            const minLevel = _.min(group.map((mark) => mark.level)) as number
            const maxLevel = _.max(group.map((mark) => mark.level)) as number
            for (const mark of group) {
                mark.level -= minLevel
                mark.totalLevels = maxLevel - minLevel + 1
            }
        }

        return groups.flat()
    }

    @computed private get seriesSortedByImportance():
        | PlacedLabelSeries[]
        | undefined {
        if (!this.options.seriesNamesSortedByImportance) return undefined
        return excludeUndefined(
            this.options.seriesNamesSortedByImportance.map((seriesName) =>
                this.initialPlacedSeriesByName.get(seriesName)
            )
        )
    }

    private computeHeight(series: PlacedLabelSeries[]): number {
        return (
            _.sumBy(series, (series) => series.bounds.height) +
            (series.length - 1) * LEGEND_ITEM_MIN_SPACING
        )
    }

    @computed get visiblePlacedSeries(): PlacedLabelSeries[] {
        const { initialPlacedSeries, seriesSortedByImportance, legendY } = this
        const availableHeight = Math.abs(legendY[1] - legendY[0])
        const totalHeight = this.computeHeight(initialPlacedSeries)

        // early return if filtering is not needed
        if (totalHeight <= availableHeight) return initialPlacedSeries

        // if a list of series sorted by importance is provided, use it
        if (seriesSortedByImportance) {
            return findImportantSeriesThatFitIntoTheAvailableSpace(
                seriesSortedByImportance,
                availableHeight
            )
        }

        // otherwise use the default filtering
        return findSeriesThatFitIntoTheAvailableSpace(
            initialPlacedSeries,
            availableHeight
        )
    }

    @computed get visibleSeriesNames(): SeriesName[] {
        return this.visiblePlacedSeries.map((series) => series.seriesName)
    }

    @computed get visibleSeriesHeight(): number {
        return this.computeHeight(this.visiblePlacedSeries)
    }

    // Does this placement need line markers or is the position of the labels already clear?
    @computed get needsConnectorLines(): boolean {
        return this.placedSeries.some((series) => series.totalLevels > 1)
    }

    @computed get maxLevel(): number {
        return _.max(this.placedSeries.map((series) => series.totalLevels)) ?? 0
    }

    @computed get renderSeries(): RenderLabelSeries[] {
        const direction = this.options.textAnchor === "start" ? 1 : -1
        const markerMargin = direction * MARKER_MARGIN
        const connectorLineWidth = direction * DEFAULT_CONNECTOR_LINE_WIDTH

        return this.placedSeries.map((series) => {
            const { x } = series.origBounds
            const connectorLineCoords = {
                startX: x + markerMargin,
                endX: x + connectorLineWidth - markerMargin,
            }

            const textX = this.needsConnectorLines
                ? connectorLineCoords.endX + markerMargin
                : x + markerMargin
            const textY = series.bounds.y

            const opacity = getTextOpacityForSeries(series)

            return {
                ...series,
                labelCoords: { x: textX, y: textY },
                connectorLineCoords,
                opacity,
            }
        })
    }

    @computed get annotatedSeries(): RenderLabelSeries[] {
        return this.renderSeries.filter((series) => series.annotationTextWrap)
    }

    @computed get hasAnnotatedSeries(): boolean {
        return this.annotatedSeries.length > 0
    }
}

function groupBounds(group: PlacedLabelSeries[]): Bounds {
    const first = group[0]
    const last = group[group.length - 1]
    const height = last.bounds.bottom - first.bounds.top
    const width = Math.max(first.bounds.width, last.bounds.width)
    return new Bounds(first.bounds.x, first.bounds.y, width, height)
}

function stackGroupVertically(
    group: PlacedLabelSeries[],
    y: number
): PlacedLabelSeries[] {
    let currentY = y
    group.forEach((mark) => {
        mark.bounds = mark.bounds.set({ y: currentY })
        mark.repositions += 1
        currentY += mark.bounds.height + LEGEND_ITEM_MIN_SPACING
    })
    return group
}

function getTextOpacityForSeries(series: PlacedLabelSeries): number {
    const { hover, focus } = series

    if (hover && focus) {
        const isInForeground =
            hover.active || focus.active || (focus.idle && hover.idle)
        return isInForeground ? 1 : GRAPHER_OPACITY_MUTE
    }

    if (hover) return hover.background ? GRAPHER_OPACITY_MUTE : 1
    if (focus) return focus.background ? GRAPHER_OPACITY_MUTE : 1

    return 1
}
