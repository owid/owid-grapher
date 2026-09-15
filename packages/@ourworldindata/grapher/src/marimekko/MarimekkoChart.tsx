import React from "react"
import * as R from "remeda"
import {
    Bounds,
    Color,
    excludeUndefined,
    HorizontalAlign,
    Position,
    getRelativeMouse,
    EntitySelectionMode,
    makeFigmaId,
    dyFromAlign,
    exposeInstanceOnWindow,
} from "@ourworldindata/utils"
import { action, computed, makeObservable, observable } from "mobx"
import { observer } from "mobx-react"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import { DualAxisComponent } from "../axis/AxisViews"
import { NoDataMessage } from "../noDataMessage/NoDataMessage"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import { VerticalAlign } from "@ourworldindata/types"
import {
    OwidTable,
    CoreColumn,
    ColumnTypeMap,
} from "@ourworldindata/core-table"
import { LEGEND_STYLE_FOR_STACKED_CHARTS } from "../stackedCharts/StackedConstants"
import { TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipValue,
    TooltipState,
    makeTooltipRoundingNotice,
    makeTooltipToleranceNotice,
} from "../tooltip/Tooltip"
import { HorizontalCategoricalColorLegend } from "../legend/HorizontalCategoricalColorLegend"
import { HorizontalCategoricalColorLegendState } from "../legend/HorizontalCategoricalColorLegendState"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import {
    BinEmphasis,
    LegendStyleConfig,
    toBinEmphasis,
} from "../legend/LegendStyleConfig"
import { Emphasis } from "../interaction/Emphasis"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import {
    LABEL_ANGLE_IN_DEGREES,
    MarimekkoChartManager,
    MarimekkoLabelCandidate,
    MarimekkoLabelMeasurements,
    MarimekkoNoDataArea,
    MarimekkoSeries,
    PlacedMarimekkoLabel,
    PlacedMarimekkoSeries,
    RenderMarimekkoSeries,
} from "./MarimekkoChartConstants"
import { MarimekkoChartState } from "./MarimekkoChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import { MarimekkoBars } from "./MarimekkoBars"
import {
    measureMarimekkoLabels,
    pickMarimekkoLabelCandidates,
    toMarimekkoNoDataArea,
    toPlacedMarimekkoLabels,
    toPlacedMarimekkoSeries,
    toRenderMarimekkoSeries,
    toShiftedLabelRuns,
} from "./MarimekkoChartHelpers"

const MARKER_MARGIN = 4
const MARKER_AREA_HEIGHT = 25

export type MarimekkoChartProps = ChartComponentProps<MarimekkoChartState>

@observer
export class MarimekkoChart
    extends React.Component<MarimekkoChartProps>
    implements ChartInterface, AxisManager
{
    base = React.createRef<SVGGElement>()

    constructor(props: MarimekkoChartProps) {
        super(props)

        makeObservable(this, {
            hoveredColorBin: observable,
            tooltipState: observable,
        })
    }

    // currently hovered legend color
    hoveredColorBin: ColorScaleBin | undefined = undefined

    // current tooltip target & position
    tooltipState = new TooltipState<{
        entityName: string
    }>()

    @computed get chartState(): MarimekkoChartState {
        return this.props.chartState
    }

    @computed private get manager(): MarimekkoChartManager {
        return this.chartState.manager
    }

    @computed private get series(): readonly MarimekkoSeries[] {
        return this.chartState.series
    }

    @computed private get latestTime(): number | undefined {
        const { yColumnSlug } = this.chartState
        const times = yColumnSlug
            ? this.manager.tableAfterAuthorTimelineAndActiveChartTransform?.getTimesUniqSortedAscForColumns(
                  [yColumnSlug]
              )
            : undefined

        return times ? R.last(times) : undefined
    }
    @computed private get tableAtLatestTimelineTimepoint():
        | OwidTable
        | undefined {
        if (this.latestTime)
            return this.manager.tableAfterAuthorTimelineAndActiveChartTransform?.filterByTargetTimes(
                [this.latestTime],
                0
            )
        else return undefined
    }
    @computed private get xColumnAtLastTimePoint(): CoreColumn | undefined {
        const { xColumnSlug } = this.chartState
        if (xColumnSlug === undefined) return undefined
        if (this.tableAtLatestTimelineTimepoint)
            return this.tableAtLatestTimelineTimepoint.getColumns([
                xColumnSlug,
            ])[0]
        else return undefined
    }

    @computed private get yColumnAtLastTimePoint(): CoreColumn | undefined {
        const { yColumnSlug } = this.chartState
        if (yColumnSlug === undefined) return undefined
        return this.tableAtLatestTimelineTimepoint?.getColumns([yColumnSlug])[0]
    }

    @computed private get bounds(): Bounds {
        return (this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS).padRight(10)
    }

    @computed private get innerBounds(): Bounds {
        // This is a workaround to get the actual width of the vertical axis - dualAxis does this
        // internally but we can't access this.dualAxis here due to a dependency cycle
        const axis = this.verticalAxisPart.clone()
        axis.range = [0, this.bounds.height]
        const verticalAxisTrueWidth = axis.width

        const whiteSpaceOnLeft = this.bounds.left + verticalAxisTrueWidth
        const labelLinesHeight = MARKER_AREA_HEIGHT
        // only pad left by the amount the longest label would exceed whatever space the
        // vertical axis needs anyhow for label and tickmarks
        const marginToEnsureWidestEntityLabelFitsEvenIfAtX0 =
            Math.max(whiteSpaceOnLeft, this.labelMeasurements.rotatedMaxWidth) -
            whiteSpaceOnLeft
        return this.bounds
            .padBottom(this.labelMeasurements.rotatedMaxHeight + 2)
            .padBottom(labelLinesHeight)
            .padTop(
                this.showLegend
                    ? this.legendState.height + this.legendPaddingTop
                    : 0
            )
            .padLeft(marginToEnsureWidestEntityLabelFitsEvenIfAtX0)
    }

    @computed private get isStatic(): boolean {
        return this.manager.isStatic ?? false
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get xRange(): [number, number] {
        return [this.bounds.left, this.bounds.right]
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    @computed private get xAxisConfig(): AxisConfig {
        const { xColumnSlug } = this.chartState
        return new AxisConfig(
            {
                ...this.manager.xAxisConfig,
                orient: Position.top,
                hideAxis: xColumnSlug === undefined,
                hideGridlines: xColumnSlug === undefined,
            },
            this
        )
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        return this.chartState.toVerticalAxis(this.yAxisConfig)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        return this.chartState.toHorizontalAxis(this.xAxisConfig)
    }

    @computed private get dualAxis(): DualAxis {
        return new DualAxis({
            bounds: this.innerBounds,
            verticalAxis: this.verticalAxisPart,
            horizontalAxis: this.horizontalAxisPart,
            comparisonLines: this.manager.comparisonLines,
        })
    }

    @computed get placedSeries(): PlacedMarimekkoSeries[] {
        const { x0, y0, sortedSeries } = this.chartState
        return toPlacedMarimekkoSeries(sortedSeries, {
            x0,
            y0,
            dualAxis: this.dualAxis,
        })
    }

    @computed private get hoveredEntityName(): string | undefined {
        const { target, fading } = this.tooltipState
        return target && !fading ? target.entityName : undefined
    }

    @computed private get renderSeries(): RenderMarimekkoSeries[] {
        return toRenderMarimekkoSeries(this.placedSeries, {
            hoveredEntityName: this.hoveredEntityName,
            hoveredColorBin: this.hoveredColorBin,
        })
    }

    @computed private get noDataArea(): MarimekkoNoDataArea | undefined {
        return toMarimekkoNoDataArea(this.placedSeries)
    }

    @computed private get placedSeriesByEntityName(): Map<
        string,
        PlacedMarimekkoSeries
    > {
        return new Map(
            this.placedSeries.map((series) => [series.entityName, series])
        )
    }

    // legend props

    @computed private get legendPaddingTop(): number {
        return this.legendState.height > 0 ? this.fontSize : 0
    }

    @computed private get legendWidth(): number {
        return this.bounds.width
    }

    @computed get detailsOrderedByReference(): string[] {
        return this.manager.detailsOrderedByReference ?? []
    }

    @computed private get categoricalLegendData(): CategoricalBin[] {
        if (!this.chartState.colorColumnSlug) return []
        return this.chartState.colorScale.categoricalLegendBins
    }

    private readonly resolveLegendBinEmphasis = (
        bin: ColorScaleBin
    ): Emphasis => {
        if (!this.activeColors && !this.hoverColors) return Emphasis.Default

        const isHovered = this.hoverColors?.includes(bin.color)
        if (isHovered) return Emphasis.Highlighted

        const isActive = this.activeColors?.includes(bin.color)
        return isActive ? Emphasis.Highlighted : Emphasis.Muted
    }

    @computed private get categoricalLegendEmphasis(): BinEmphasis {
        return toBinEmphasis(
            this.categoricalLegendData,
            this.resolveLegendBinEmphasis
        )
    }

    legendStyleConfig: LegendStyleConfig = LEGEND_STYLE_FOR_STACKED_CHARTS

    @computed private get hoverColors(): Color[] | undefined {
        if (this.hoveredColorBin) return [this.hoveredColorBin.color]
        const { entityColor } = this.tooltipSeries ?? {}
        return entityColor ? [entityColor.color] : undefined
    }

    @computed private get activeColors(): Color[] | undefined {
        const colors = R.unique(
            excludeUndefined(
                this.series
                    .filter((series) => series.focus.active)
                    .map((series) => series.entityColor?.color)
            )
        )
        return colors.length > 0 ? colors : undefined
    }

    @computed private get showLegend(): boolean {
        return !!this.chartState.colorColumnSlug && !!this.manager.showLegend
    }

    @action.bound onLegendMouseOver(bin: ColorScaleBin): void {
        this.chartState.focusArray.clear()
        this.hoveredColorBin = bin
    }

    @action.bound onLegendMouseLeave(): void {
        this.hoveredColorBin = undefined
    }

    @computed private get legendState(): HorizontalCategoricalColorLegendState {
        return new HorizontalCategoricalColorLegendState(
            this.categoricalLegendData,
            {
                fontSize: this.fontSize,
                width: this.legendWidth,
                align: HorizontalAlign.left,
            }
        )
    }

    @action.bound private onEntityMouseOver(entityName: string): void {
        this.chartState.focusArray.clear()
        this.tooltipState.target = { entityName }
    }

    @action.bound private onMouseMove(ev: React.MouseEvent): void {
        const ref = this.manager.base?.current
        if (ref) {
            this.tooltipState.position = getRelativeMouse(ref, ev)
        }
    }

    @action.bound private dismissTooltip(): void {
        this.tooltipState.target = null
    }

    @action.bound private onEntityClick(entityName: string): void {
        this.onSelectEntity(entityName)
    }

    @action.bound private onSelectEntity(entityName: string): void {
        if (this.canAddCountry)
            this.chartState.selectionArray.toggleSelection(entityName)
    }
    @computed private get canAddCountry(): boolean {
        const { addCountryMode } = this.manager
        return (addCountryMode &&
            addCountryMode !== EntitySelectionMode.Disabled) as boolean
    }

    @computed private get tooltipSeries(): MarimekkoSeries | undefined {
        const { target } = this.tooltipState
        return (
            target &&
            this.series.find(
                ({ entityName }) => entityName === target.entityName
            )
        )
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }

    override render(): React.ReactElement {
        if (this.chartState.errorInfo.reason)
            return (
                <NoDataMessage
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        const {
            manager,
            bounds,
            dualAxis,
            tooltipSeries,
            manager: { endTime, xOverrideTime },
            tooltipState: { target, position, fading },
        } = this
        const { xColumn, yColumn, colorColumn, colorScale } = this.chartState
        const { timeColumn } = this.chartState.inputTable

        const { entityName, xPoint, yPoint } = tooltipSeries ?? {}

        const yOriginalTimeFormatted =
            yPoint && yPoint.time !== endTime
                ? yColumn.formatTime(yPoint.time)
                : undefined

        // The x axis label already states an overridden x time
        const shouldShowXTimeNotice =
            xPoint && xPoint.time !== endTime && xOverrideTime === undefined
        const xOriginalTime = shouldShowXTimeNotice ? xPoint?.time : undefined
        const xOriginalTimeFormatted = xOriginalTime
            ? xColumn?.formatTime(xOriginalTime)
            : undefined
        const targetNotice =
            xOriginalTime || yOriginalTimeFormatted
                ? timeColumn.formatValue(endTime)
                : undefined
        const toleranceNotice = targetNotice
            ? {
                  icon: TooltipFooterIcon.Notice,
                  text: makeTooltipToleranceNotice(targetNotice),
              }
            : undefined

        const columns = excludeUndefined([xColumn, yColumn])
        const allRoundedToSigFigs = columns.every(
            (column) => column.roundsToSignificantFigures
        )
        const anyRoundedToSigFigs = columns.some(
            (column) => column.roundsToSignificantFigures
        )
        const sigFigs = excludeUndefined(
            columns.map((column) =>
                column.roundsToSignificantFigures
                    ? column.numSignificantFigures
                    : undefined
            )
        )
        const roundingNotice = anyRoundedToSigFigs
            ? {
                  icon: allRoundedToSigFigs
                      ? TooltipFooterIcon.None
                      : TooltipFooterIcon.Significance,
                  text: makeTooltipRoundingNotice(sigFigs, {
                      plural: sigFigs.length > 1,
                  }),
              }
            : undefined
        const showSignificanceSuperscriptIfApplicable =
            !!roundingNotice && roundingNotice.icon !== TooltipFooterIcon.None

        const footer = excludeUndefined([toleranceNotice, roundingNotice])

        return (
            <g
                ref={this.base}
                id={makeFigmaId("marimekko-chart")}
                onMouseMove={(ev): void => this.onMouseMove(ev)}
                onMouseLeave={(): void => this.dismissTooltip()}
            >
                <rect
                    x={bounds.left}
                    y={bounds.top}
                    width={bounds.width}
                    height={bounds.height}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                <DualAxisComponent
                    dualAxis={dualAxis}
                    showTickMarks={true}
                    detailsMarker={manager.detailsMarkerInSvg}
                />
                {this.showLegend && (
                    <HorizontalCategoricalColorLegend
                        state={this.legendState}
                        x={this.bounds.x}
                        y={this.bounds.top}
                        interactive={!this.isStatic}
                        styleConfig={this.legendStyleConfig}
                        binEmphasis={this.categoricalLegendEmphasis}
                        onMouseOver={this.onLegendMouseOver}
                        onMouseLeave={this.onLegendMouseLeave}
                    />
                )}
                {this.renderBars()}
                {this.renderLabelLines()}
                {this.renderLabels()}
                {target && (
                    <Tooltip
                        id="marimekkoTooltip"
                        tooltipManager={this.manager}
                        x={position.x}
                        y={position.y}
                        style={{ maxWidth: "250px" }}
                        offsetX={20}
                        offsetY={-16}
                        title={entityName}
                        subtitle={timeColumn.formatValue(endTime)}
                        footer={footer}
                        dissolve={fading}
                        dismiss={() => (this.tooltipState.target = null)}
                    >
                        {yPoint && (
                            <TooltipValue
                                label={yColumn.displayName}
                                unit={yColumn.displayUnit}
                                value={yColumn.formatValueShort(yPoint.value)}
                                originalTime={yOriginalTimeFormatted}
                                showSignificanceSuperscript={
                                    showSignificanceSuperscriptIfApplicable &&
                                    yColumn.roundsToSignificantFigures
                                }
                            />
                        )}
                        {xColumn && !xColumn.isMissing && (
                            <TooltipValue
                                label={xColumn.displayName}
                                unit={xColumn.displayUnit}
                                value={xColumn.formatValueShort(xPoint?.value)}
                                originalTime={xOriginalTimeFormatted}
                                showSignificanceSuperscript={
                                    showSignificanceSuperscriptIfApplicable &&
                                    xColumn.roundsToSignificantFigures
                                }
                            />
                        )}
                        {!colorColumn.isMissing &&
                            tooltipSeries?.entityColor &&
                            !(
                                colorColumn instanceof ColumnTypeMap.Continent
                            ) && (
                                <TooltipValue
                                    label={
                                        colorScale.legendDescription ??
                                        colorColumn.displayName
                                    }
                                    value={
                                        colorScale.getBinForValue(
                                            tooltipSeries.entityColor
                                                .colorDomainValue
                                        )?.label ??
                                        tooltipSeries.entityColor
                                            .colorDomainValue
                                    }
                                />
                            )}
                    </Tooltip>
                )}
            </g>
        )
    }

    private renderBars(): React.ReactElement {
        return (
            <MarimekkoBars
                series={this.renderSeries}
                noDataArea={this.noDataArea}
                fontSize={this.fontSize}
                onEntityClick={this.onEntityClick}
                onEntityMouseLeave={this.dismissTooltip}
                onEntityMouseOver={this.onEntityMouseOver}
            />
        )
    }

    @computed private get pickedLabelCandidates(): MarimekkoLabelCandidate[] {
        const { xColumnAtLastTimePoint, yColumnAtLastTimePoint, xRange } = this
        const { selectedSeries, focusArray } = this.chartState

        return pickMarimekkoLabelCandidates({
            entityNamesWithBars: new Set(
                this.series.map(({ entityName }) => entityName)
            ),
            xColumnAtLastTimePoint,
            yColumnAtLastTimePoint,
            selectedEntityNames: new Set(
                selectedSeries.map((series) => series.entityName)
            ),
            focusArray,
            availableWidth: xRange[1] - xRange[0],
            fontSize: this.entityLabelFontSize,
        })
    }

    @computed private get labelMeasurements(): MarimekkoLabelMeasurements {
        return measureMarimekkoLabels(this.pickedLabelCandidates, {
            fontSize: this.fontSize,
        })
    }

    @computed private get placedLabels(): PlacedMarimekkoLabel[] {
        const { x0, domainColorForEntityMap, yColumnColor } = this.chartState

        return toPlacedMarimekkoLabels(this.pickedLabelCandidates, {
            placedSeriesByEntityName: this.placedSeriesByEntityName,
            domainColorForEntityMap,
            fallbackColor: yColumnColor,
            measurements: this.labelMeasurements,
            dualAxis: this.dualAxis,
            x0,
        })
    }

    @computed private get shiftedLabelRuns(): PlacedMarimekkoLabel[][] {
        return toShiftedLabelRuns(this.placedLabels)
    }

    private renderLabelLines(): React.ReactElement[] {
        const barEndpointY = this.dualAxis.verticalAxis.place(0)
        const markerBarEndpointY = barEndpointY + MARKER_MARGIN
        const markerTextEndpointY =
            barEndpointY + MARKER_AREA_HEIGHT - MARKER_MARGIN
        const markerNetHeight = MARKER_AREA_HEIGHT - 2 * MARKER_MARGIN

        const labelLines: React.ReactElement[] = []
        for (const run of this.shiftedLabelRuns) {
            const markerStepSize = markerNetHeight / (run.length + 1)
            run.forEach((label, indexInRun) => {
                const directionUnawareMakerYMid =
                    (indexInRun + 1) * markerStepSize
                const markerYMid =
                    label.preferredX > label.correctedX
                        ? directionUnawareMakerYMid
                        : markerNetHeight - directionUnawareMakerYMid
                labelLines.push(
                    <g
                        id={makeFigmaId("label-line", label.entityName)}
                        className="indicator"
                        key={`labelline-${label.entityName}`}
                    >
                        <path
                            d={`M${label.preferredX},${markerBarEndpointY} v${markerYMid} H${label.correctedX} V${markerTextEndpointY}`}
                            stroke={label.isSelected ? "#999" : "#bbb"}
                            strokeWidth={1}
                            fill="none"
                        />
                    </g>
                )
            })
        }
        const unshiftedLabels = this.placedLabels.filter(
            (label) => label.preferredX === label.correctedX
        )
        for (const label of unshiftedLabels) {
            labelLines.push(
                <g
                    id={makeFigmaId("label-line", label.entityName)}
                    key={`labelline-${label.entityName}`}
                >
                    <path
                        d={`M${label.preferredX},${markerBarEndpointY} V${markerTextEndpointY}`}
                        stroke={label.isSelected ? "#555" : "#bbb"}
                        strokeWidth={1}
                        fill="none"
                    />
                </g>
            )
        }
        return labelLines
    }

    private renderLabels(): React.ReactElement[] {
        const labelsY = MARKER_AREA_HEIGHT + this.dualAxis.verticalAxis.place(0)
        return this.placedLabels.map((label) => (
            <g
                key={`label-${label.entityName}`}
                id={makeFigmaId("label", label.entityName)}
                transform={`translate(${label.correctedX}, ${labelsY})`}
            >
                <text
                    y={0}
                    fontWeight={label.isSelected ? 700 : 400}
                    fill={label.color}
                    transform={`rotate(${LABEL_ANGLE_IN_DEGREES}, 0, 0)`}
                    fontSize={this.entityLabelFontSize}
                    textAnchor="end"
                    dy={dyFromAlign(VerticalAlign.middle)}
                    onMouseOver={(): void =>
                        this.onEntityMouseOver(label.entityName)
                    }
                    onMouseLeave={(): void => this.dismissTooltip()}
                    onClick={(): void => this.onEntityClick(label.entityName)}
                >
                    {label.text}
                </text>
            </g>
        ))
    }

    @computed private get entityLabelFontSize(): number {
        return GRAPHER_FONT_SCALE_12 * this.fontSize
    }
}
