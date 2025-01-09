// This implements the line labels that appear to the right of the lines/polygons in LineCharts/StackedAreas.
import React from "react"
import {
    Bounds,
    noop,
    cloneDeep,
    max,
    min,
    sortBy,
    makeIdForHumanConsumption,
    excludeUndefined,
    sumBy,
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
import { GRAPHER_BACKGROUND_DEFAULT, GRAY_30 } from "../color/ColorConstants"
import {
    findImportantSeriesThatFitIntoTheAvailableSpace,
    findSeriesThatFitIntoTheAvailableSpace,
} from "./LineLegendFilterAlgorithms.js"
import {
    ANNOTATION_PADDING,
    DEFAULT_CONNECTOR_LINE_WIDTH,
    DEFAULT_FONT_WEIGHT,
    LEGEND_ITEM_MIN_SPACING,
    MARKER_MARGIN,
    NON_FOCUSED_TEXT_COLOR,
} from "./LineLegendConstants.js"
import { getSeriesKey } from "./LineLegendHelpers"

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
                {this.markers.map(({ series, labelText }, index) => {
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
                            key={getSeriesKey(series, index)}
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
                {markersWithAnnotations.map(({ series, labelText }, index) => {
                    if (!series.annotationTextWrap) return
                    return (
                        <Halo
                            id={series.seriesName}
                            key={getSeriesKey(series, index)}
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
                {this.markers.map(({ series, connectorLine }, index) => {
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
                            key={getSeriesKey(series, index)}
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
                    const x =
                        this.anchor === "start"
                            ? series.origBounds.x
                            : series.origBounds.x - series.bounds.width
                    return (
                        <g
                            key={getSeriesKey(series, index)}
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
