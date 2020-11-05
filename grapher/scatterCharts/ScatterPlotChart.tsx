import * as React from "react"
import { observable, computed, action } from "mobx"
import {
    intersection,
    without,
    uniq,
    last,
    excludeUndefined,
    flatten,
    isEmpty,
    isNumber,
    domainExtent,
    lowerCaseFirstLetterUnlessAbbreviation,
    relativeMinAndMax,
    exposeInstanceOnWindow,
    groupBy,
    first,
} from "grapher/utils/Util"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { NoDataModal } from "grapher/noDataModal/NoDataModal"
import {
    BASE_FONT_SIZE,
    ScaleType,
    EntitySelectionMode,
    ScatterPointLabelStrategy,
    SeriesName,
} from "grapher/core/GrapherConstants"
import { Color } from "coreTable/CoreTableConstants"
import {
    ConnectedScatterLegend,
    ConnectedScatterLegendManager,
} from "./ConnectedScatterLegend"
import {
    VerticalColorLegend,
    VerticalColorLegendManager,
} from "grapher/verticalColorLegend/VerticalColorLegend"
import { DualAxisComponent } from "grapher/axis/AxisViews"
import { DualAxis } from "grapher/axis/Axis"
import { ComparisonLine } from "./ComparisonLine"

import { ColorScale, ColorScaleManager } from "grapher/color/ColorScale"
import { AxisConfig } from "grapher/axis/AxisConfig"
import { ChartInterface } from "grapher/chart/ChartInterface"
import {
    ScatterPlotManager,
    ScatterSeries,
    SeriesPoint,
} from "./ScatterPlotChartConstants"
import { ScatterTooltip } from "./ScatterTooltip"
import { ScatterPointsWithLabels } from "./ScatterPointsWithLabels"
import {
    EntityName,
    OwidRow,
    OwidTableSlugs,
} from "coreTable/OwidTableConstants"
import { OwidTable } from "coreTable/OwidTable"
import {
    autoDetectYColumnSlugs,
    makeSelectionArray,
} from "grapher/chart/ChartUtils"
import { ColorSchemeName } from "grapher/color/ColorConstants"
import { isNotErrorValue } from "coreTable/ErrorValues"
import { replaceErrorValuesWithUndefined } from "coreTable/CoreTableUtils"

@observer
export class ScatterPlotChart
    extends React.Component<{
        bounds?: Bounds
        manager: ScatterPlotManager
    }>
    implements
        ConnectedScatterLegendManager,
        ChartInterface,
        VerticalColorLegendManager,
        ColorScaleManager {
    // currently hovered individual series key
    @observable private hoveredSeries?: SeriesName
    // currently hovered legend color
    @observable private hoverColor?: Color

    transformTable(table: OwidTable) {
        if (this.manager.matchingEntitiesOnly && this.colorColumnSlug)
            table = table.dropRowsWithErrorValuesForColumn(this.colorColumnSlug)

        if (this.manager.excludedEntities) {
            const excludedEntityIdsSet = new Set(this.manager.excludedEntities)
            table = table.columnFilter(
                OwidTableSlugs.entityId,
                (entityId) => !excludedEntityIdsSet.has(entityId as number),
                `Excluded entity ids specified by author: ${this.manager.excludedEntities.join(
                    ", "
                )}`
            )
        }

        if (this.xScaleType === ScaleType.log && this.xColumnSlug)
            table = table.replaceNonPositiveCellsForLogScale([this.xColumnSlug])

        if (this.yScaleType === ScaleType.log && this.yColumnSlug)
            table = table.replaceNonPositiveCellsForLogScale([this.yColumnSlug])

        // To avoid injecting unnecessary rows in the interpolateColumnWithTolerance() transform,
        // we drop any rows which are blank for both X and Y values.
        // The common case is that the Population data goes back to 10,000 BCE and in almost every
        // case we don't have that data for X and Y.
        // -@danielgavrilov, 2020-10-22
        //
        // UPDATE: We cannot drop rows here, because it may lead to missing color/size data - those
        // columns usually have Infinity tolerance. Leaving this note as we'll probably try to
        // optimize this later.
        // -@danielgavrilov, 2020-10-30
        //
        // table = table.dropRowsWithErrorValuesForAllColumns([
        //     this.xColumnSlug,
        //     this.yColumnSlug,
        // ])

        if (this.xColumnSlug) {
            table = table.interpolateColumnWithTolerance(this.xColumnSlug)
        }

        if (this.yColumnSlug) {
            table = table.interpolateColumnWithTolerance(this.yColumnSlug)
        }

        if (this.sizeColumnSlug) {
            // The tolerance on the size column is ignored. If we want to change this in the future
            // we need to check all charts for regressions.
            table = table.interpolateColumnWithTolerance(
                this.sizeColumnSlug,
                Infinity
            )
        }

        if (this.colorColumnSlug) {
            const tolerance =
                table.get(this.colorColumnSlug)?.display.tolerance ?? Infinity
            table = table.interpolateColumnWithTolerance(
                this.colorColumnSlug,
                tolerance
            )
        }

        // Drop any rows which have an invalid cell for either X or Y.
        // This needs to be done after the tolerance, because the tolerance may fill in some gaps.
        table = table
            .columnFilter(
                this.xColumnSlug,
                isNumber,
                "Filter non-number values from X column"
            )
            .columnFilter(
                this.yColumnSlug,
                isNumber,
                "Filter non-number values from Y column"
            )

        return table
    }

    @computed get inputTable() {
        return this.manager.table
    }

    @computed get transformedTable() {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed private get manager() {
        return this.props.manager
    }

    @computed.struct private get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get canAddCountry() {
        const { addCountryMode } = this.manager
        return addCountryMode && addCountryMode !== EntitySelectionMode.Disabled
    }

    @computed private get selectionArray() {
        return makeSelectionArray(this.manager)
    }

    @action.bound private onSelectEntity(entityName: SeriesName) {
        if (this.canAddCountry) this.selectionArray.toggleSelection(entityName)
    }

    // Returns the colors that are used by all points, *across the whole timeline*.
    // This is why we need the table before the timeline filter is applied.
    @computed private get colorsInUse(): Color[] {
        const allValues =
            this.manager.tableAfterAuthorTimelineAndActiveChartTransformAndPopulationFilter?.get(
                this.colorColumnSlug
            )?.allValues ?? []
        // Need to convert InvalidCell to undefined for color scale to assign correct color
        const colorValues = uniq(
            allValues.map((value) => (isValid(value) ? value : undefined))
        ) as (string | number)[]
        return excludeUndefined(
            colorValues.map((colorValue) =>
                this.colorScale.getColor(colorValue)
            )
        )
    }

    @computed get fontSize() {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @action.bound onLegendMouseOver(color: string) {
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.hoverColor = undefined
    }

    // When the color legend is clicked, toggle selection fo all associated keys
    @action.bound onLegendClick() {
        const { hoverColor, selectionArray } = this
        if (!this.canAddCountry || hoverColor === undefined) return

        const keysToToggle = this.series
            .filter((g) => g.color === hoverColor)
            .map((g) => g.seriesName)
        const allKeysActive =
            intersection(keysToToggle, this.selectedEntityNames).length ===
            keysToToggle.length
        if (allKeysActive)
            selectionArray.setSelectedEntities(
                without(this.selectedEntityNames, ...keysToToggle)
            )
        else
            selectionArray.setSelectedEntities(
                uniq(this.selectedEntityNames.concat(keysToToggle))
            )
    }

    // Colors on the legend for which every matching series is focused
    @computed get focusColors() {
        const { colorsInUse } = this
        return colorsInUse.filter((color) => {
            const matchingKeys = this.series
                .filter((g) => g.color === color)
                .map((g) => g.seriesName)
            return (
                intersection(matchingKeys, this.selectedEntityNames).length ===
                matchingKeys.length
            )
        })
    }

    // All currently hovered series keys, combining the legend and the main UI
    @computed private get hoveredSeriesNames() {
        const { hoverColor, hoveredSeries } = this

        const hoveredSeriesNames =
            hoverColor === undefined
                ? []
                : uniq(
                      this.series
                          .filter((g) => g.color === hoverColor)
                          .map((g) => g.seriesName)
                  )

        if (hoveredSeries !== undefined) hoveredSeriesNames.push(hoveredSeries)

        return hoveredSeriesNames
    }

    @computed private get focusedEntityNames() {
        return this.selectedEntityNames
    }

    @computed private get selectedEntityNames() {
        return this.selectionArray.selectedEntityNames
    }

    @computed get displayStartTime() {
        return this.transformedTable.timeColumnFormatFunction(
            this.transformedTable.minTime ?? 1900
        )
    }

    @computed get displayEndTime() {
        return this.transformedTable.timeColumnFormatFunction(
            this.transformedTable.maxTime ?? 2000
        )
    }

    @computed private get arrowLegend() {
        if (
            this.displayStartTime === this.displayEndTime ||
            this.manager.isRelativeMode
        )
            return undefined

        return new ConnectedScatterLegend(this)
    }

    @action.bound private onScatterMouseOver(series: ScatterSeries) {
        this.hoveredSeries = series.seriesName
    }

    @action.bound private onScatterMouseLeave() {
        this.hoveredSeries = undefined
    }

    @action.bound private onScatterClick() {
        if (this.hoveredSeries) this.onSelectEntity(this.hoveredSeries)
    }

    @computed private get tooltipSeries() {
        const { hoveredSeries, focusedEntityNames } = this
        if (hoveredSeries !== undefined)
            return this.series.find((g) => g.seriesName === hoveredSeries)
        if (focusedEntityNames && focusedEntityNames.length === 1)
            return this.series.find(
                (g) => g.seriesName === focusedEntityNames[0]
            )
        return undefined
    }

    @computed private get legendDimensions(): VerticalColorLegend {
        return new VerticalColorLegend({ manager: this })
    }

    @computed get maxLegendWidth() {
        return this.sidebarMaxWidth
    }

    @computed private get sidebarMinWidth() {
        return Math.max(this.bounds.width * 0.1, 60)
    }

    @computed private get sidebarMaxWidth() {
        return Math.max(this.bounds.width * 0.2, this.sidebarMinWidth)
    }

    @computed.struct get sidebarWidth() {
        const { legendDimensions, sidebarMinWidth, sidebarMaxWidth } = this

        return Math.max(
            Math.min(legendDimensions.width, sidebarMaxWidth),
            sidebarMinWidth
        )
    }

    // todo: Refactor
    @computed get dualAxis() {
        const { horizontalAxisPart, verticalAxisPart } = this
        return new DualAxis({
            bounds: this.bounds.padRight(this.sidebarWidth + 20),
            horizontalAxis: horizontalAxisPart,
            verticalAxis: verticalAxisPart,
        })
    }

    @computed private get comparisonLines() {
        return this.manager.comparisonLines
    }

    @action.bound private onToggleEndpoints() {
        this.compareEndPointsOnly = !this.compareEndPointsOnly
    }

    // Colors currently on the chart and not greyed out
    @computed get activeColors() {
        const { hoveredSeriesNames, focusedEntityNames } = this
        const activeKeys = hoveredSeriesNames.concat(focusedEntityNames)

        let series = this.series

        if (activeKeys.length)
            series = series.filter((g) => activeKeys.includes(g.seriesName))

        const colorValues = uniq(
            flatten(series.map((s) => s.points.map((p) => p.color)))
        )
        return excludeUndefined(
            colorValues.map((color) => this.colorScale.getColor(color))
        )
    }

    @computed private get hideLines() {
        return !!this.manager.hideConnectedScatterLines
    }

    @computed private get points() {
        const {
            dualAxis,
            focusedEntityNames,
            hoveredSeriesNames,
            hideLines,
            manager,
            series,
            sizeDomain,
            colorScale,
            colorColumn,
            transformedTable,
        } = this

        return (
            <ScatterPointsWithLabels
                noDataModalManager={manager}
                hideLines={hideLines}
                seriesArray={series}
                dualAxis={dualAxis}
                colorScale={!colorColumn.isMissing ? colorScale : undefined}
                sizeDomain={sizeDomain}
                focusedSeriesNames={focusedEntityNames}
                hoveredSeriesNames={hoveredSeriesNames}
                onMouseOver={this.onScatterMouseOver}
                onMouseLeave={this.onScatterMouseLeave}
                onClick={this.onScatterClick}
            />
        )
    }

    @computed private get colorColumnSlug() {
        return this.manager.colorColumnSlug
    }

    @computed private get colorColumn() {
        return this.transformedTable.get(this.colorColumnSlug)
    }

    @computed get legendItems() {
        return this.colorScale.legendBins.filter((bin) =>
            this.colorsInUse.includes(bin.color)
        )
    }

    @computed get title() {
        return this.colorScale.legendDescription
    }

    componentDidMount() {
        exposeInstanceOnWindow(this)
    }

    render() {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        const {
            bounds,
            dualAxis,
            arrowLegend,
            sidebarWidth,
            tooltipSeries,
            comparisonLines,
            manager,
            legendDimensions,
        } = this

        return (
            <g className="ScatterPlot">
                <DualAxisComponent
                    isInteractive={!manager.isStaticSvg}
                    dualAxis={dualAxis}
                    showTickMarks={false}
                />
                {comparisonLines &&
                    comparisonLines.map((line, i) => (
                        <ComparisonLine
                            key={i}
                            dualAxis={dualAxis}
                            comparisonLine={line}
                        />
                    ))}
                {this.points}
                <VerticalColorLegend manager={this} />
                {(arrowLegend || tooltipSeries) && (
                    <line
                        x1={bounds.right - sidebarWidth}
                        y1={bounds.top + legendDimensions.height + 2}
                        x2={bounds.right - 5}
                        y2={bounds.top + legendDimensions.height + 2}
                        stroke="#ccc"
                    />
                )}
                {arrowLegend && (
                    <g className="clickable" onClick={this.onToggleEndpoints}>
                        {arrowLegend.render(
                            bounds.right - sidebarWidth,
                            bounds.top + legendDimensions.height + 11
                        )}
                    </g>
                )}
                {tooltipSeries && (
                    <ScatterTooltip
                        yColumn={this.yColumn!}
                        xColumn={this.xColumn!}
                        series={tooltipSeries}
                        maxWidth={sidebarWidth}
                        fontSize={this.fontSize}
                        x={bounds.right - sidebarWidth}
                        y={
                            bounds.top +
                            legendDimensions.height +
                            11 +
                            (arrowLegend ? arrowLegend.height + 10 : 0)
                        }
                    />
                )}
            </g>
        )
    }

    @computed get legendY() {
        return this.bounds.top
    }

    @computed get legendX() {
        return this.bounds.right - this.sidebarWidth
    }

    colorScale = new ColorScale(this)

    @computed get colorScaleColumn() {
        // We need to use inputTable in order to get consistent coloring for a variable across
        // charts, e.g. each continent being assigned to the same color.
        // inputTable is unfiltered, so it contains every value that exists in the variable.
        return this.inputTable.get(this.colorColumnSlug)
    }

    @computed get colorScaleConfig() {
        return this.manager.colorScale
    }

    defaultBaseColorScheme = ColorSchemeName.continents
    defaultNoDataColor = "#959595"

    @computed get hasNoDataBin() {
        if (this.colorColumn.isMissing) return false
        return this.colorColumn.valuesIncludingErrorValues.some(
            (value) => !isNotErrorValue(value)
        )
    }

    @computed private get yAxisConfig() {
        return (
            this.manager.yAxis ?? new AxisConfig(this.manager.yAxisConfig, this)
        )
    }

    @computed private get xAxisConfig() {
        return (
            this.manager.xAxis ?? new AxisConfig(this.manager.xAxisConfig, this)
        )
    }

    @computed private get yColumnSlug() {
        return autoDetectYColumnSlugs(this.manager)[0]
    }

    @computed private get yColumn() {
        return this.transformedTable.get(this.yColumnSlug)
    }

    @computed private get xColumnSlug() {
        const { xColumnSlug } = this.manager
        return xColumnSlug ?? this.manager.table.numericColumnSlugs[1]
    }

    @computed private get xColumn() {
        return this.transformedTable.get(this.xColumnSlug)
    }

    @computed private get sizeColumnSlug() {
        return this.manager.sizeColumnSlug
    }

    @computed private get sizeColumn() {
        return this.transformedTable.get(this.sizeColumnSlug)
    }

    @computed get failMessage() {
        if (this.yColumn.isMissing) return "Missing Y axis variable"

        if (this.yColumn.isMissing) return "Missing X axis variable"

        if (isEmpty(this.allEntityNamesWithXAndY))
            return "No entities with data for both X and Y"

        if (isEmpty(this.series)) return "No matching data"

        return ""
    }

    // todo: remove this. Should be done as a simple column transform at the data level.
    // Possible to override the x axis dimension to target a special year
    // In case you want to graph say, education in the past and democracy today https://ourworldindata.org/grapher/correlation-between-education-and-democracy
    @computed get xOverrideTime() {
        return this.manager.xOverrideTime
    }

    // Unlike other charts, the scatterplot shows all available data by default, and the selection
    // is just for emphasis. But this behavior can be disabled.
    @computed private get hideBackgroundEntities() {
        return this.manager.addCountryMode === EntitySelectionMode.Disabled
    }

    @computed private get allEntityNamesWithXAndY(): EntityName[] {
        return intersection(
            this.yColumn.uniqEntityNames,
            this.xColumn.uniqEntityNames
        )
    }

    // todo: remove. do this at table filter level
    getSeriesNamesToShow(
        filterBackgroundEntities = this.hideBackgroundEntities
    ): Set<SeriesName> {
        const seriesNames = filterBackgroundEntities
            ? this.selectionArray.selectedEntityNames
            : this.allEntityNamesWithXAndY

        if (this.manager.matchingEntitiesOnly && !this.colorColumn.isMissing)
            return new Set(
                intersection(seriesNames, this.colorColumn.uniqEntityNames)
            )

        return new Set(seriesNames)
    }

    @computed get compareEndPointsOnly() {
        return !!this.manager.compareEndPointsOnly
    }

    set compareEndPointsOnly(value: boolean) {
        this.manager.compareEndPointsOnly = value ?? undefined
    }

    @computed get allPoints(): SeriesPoint[] {
        return flatten(this.series.map((series) => series.points))
    }

    // domains across the entire timeline
    private domainDefault(property: "x" | "y"): [number, number] {
        const scaleType = property === "x" ? this.xScaleType : this.yScaleType
        if (!this.manager.useTimelineDomains) {
            return domainExtent(
                this.pointsForAxisDomains.map((point) => point[property]),
                scaleType,
                this.manager.zoomToSelection && this.selectedPoints.length
                    ? 1.1
                    : 1
            )
        }

        if (this.manager.isRelativeMode)
            return relativeMinAndMax(this.allPoints, property)

        return domainExtent(
            this.allPoints.map((v) => v[property]),
            scaleType
        )
    }

    @computed private get xDomainDefault() {
        return this.domainDefault("x")
    }

    @computed private get selectedPoints() {
        const seriesNamesSet = this.getSeriesNamesToShow(true)
        return this.allPoints.filter(
            (point) => point.entityName && seriesNamesSet.has(point.entityName)
        )
    }

    @computed private get pointsForAxisDomains() {
        if (
            !this.selectionArray.numSelectedEntities ||
            !this.manager.zoomToSelection
        )
            return this.allPoints

        return this.selectedPoints.length ? this.selectedPoints : this.allPoints
    }

    @computed private get sizeDomain(): [number, number] {
        if (this.sizeColumn.isMissing) return [1, 100]
        const sizeValues = this.transformedTable
            .get(this.sizeColumn.slug)
            .values.filter(isNumber)
        return domainExtent(sizeValues, ScaleType.linear)
    }

    @computed private get yScaleType() {
        return this.manager.isRelativeMode
            ? ScaleType.linear
            : this.yAxisConfig.scaleType || ScaleType.linear
    }

    @computed private get yDomainDefault() {
        return this.domainDefault("y")
    }

    @computed private get verticalAxisPart() {
        const { manager, yDomainDefault } = this
        const axisConfig = this.yAxisConfig

        const axis = axisConfig.toVerticalAxis()
        axis.formatColumn = this.yColumn
        const label = axisConfig.label || this.yColumn?.displayName || ""
        axis.scaleType = this.yScaleType

        if (manager.isRelativeMode) {
            axis.domain = yDomainDefault // Overwrite user's min/max
            if (label && label.length > 1) {
                axis.label = `Average annual change in ${lowerCaseFirstLetterUnlessAbbreviation(
                    label
                )}`
            }
        } else {
            axis.updateDomainPreservingUserSettings(yDomainDefault)
            axis.label = label
        }

        return axis
    }

    @computed private get xScaleType() {
        return this.manager.isRelativeMode
            ? ScaleType.linear
            : this.xAxisConfig.scaleType ?? ScaleType.linear
    }

    @computed private get xAxisLabelBase() {
        const xDimName = this.xColumn?.displayName
        if (this.xOverrideTime !== undefined)
            return `${xDimName} in ${this.xOverrideTime}`
        return xDimName
    }

    @computed private get horizontalAxisPart() {
        const { xDomainDefault, manager, xAxisLabelBase } = this
        const { xAxisConfig } = this
        const axis = xAxisConfig.toHorizontalAxis()
        axis.formatColumn = this.xColumn
        axis.scaleType = this.xScaleType
        if (manager.isRelativeMode) {
            axis.domain = xDomainDefault // Overwrite user's min/max
            const label = xAxisConfig.label || xAxisLabelBase
            if (label && label.length > 1) {
                axis.label = `Average annual change in ${lowerCaseFirstLetterUnlessAbbreviation(
                    label
                )}`
            }
        } else {
            axis.updateDomainPreservingUserSettings(xDomainDefault)
            const label = xAxisConfig.label || xAxisLabelBase
            if (label) axis.label = label
        }
        return axis
    }

    getPointLabel(row: OwidRow): string | undefined {
        const strat = this.manager.scatterPointLabelStrategy
        let label
        if (strat === ScatterPointLabelStrategy.year) {
            label = this.transformedTable.timeColumnFormatFunction(
                row[OwidTableSlugs.time]
            )
        } else if (strat === ScatterPointLabelStrategy.x) {
            label = this.xColumn?.formatValue(row[this.xColumnSlug])
        } else {
            label = this.yColumn?.formatValue(row[this.yColumnSlug])
        }
        return label
    }

    private removePointsOutsidePlane(points: SeriesPoint[]): SeriesPoint[] {
        // The exclusion of points happens as a last step in order to avoid artefacts due to
        // the tolerance calculation. E.g. if we pre-filter the data based on the X and Y
        // domains before creating the points, the tolerance may lead to different X-Y
        // values being joined.
        // -@danielgavrilov, 2020-04-29
        const { yAxisConfig, xAxisConfig } = this
        return points.filter((point) => {
            return (
                !xAxisConfig.shouldRemovePoint(point.x) &&
                !yAxisConfig.shouldRemovePoint(point.y)
            )
        })
    }

    @computed private get allPointsBeforeEndpointsFilter(): SeriesPoint[] {
        const entityNameSlug = this.transformedTable.entityNameSlug
        return this.removePointsOutsidePlane(
            this.transformedTable.rows.map((row) => {
                row = replaceErrorValuesWithUndefined(row)
                return {
                    x: row[this.xColumnSlug],
                    y: row[this.yColumnSlug],
                    size: !this.sizeColumn.isMissing
                        ? row[this.sizeColumn.slug]
                        : 0,
                    color: !this.colorColumn.isMissing
                        ? row[this.colorColumn.slug]
                        : undefined,
                    entityName: row[entityNameSlug],
                    label: this.getPointLabel(row) ?? "",
                    timeValue: row[OwidTableSlugs.time],
                    time: {
                        x: row[this.xColumn!.originalTimeColumnSlug!],
                        y: row[this.yColumn!.originalTimeColumnSlug!],
                    },
                }
            })
        )
    }

    // todo: refactor/remove and/or add unit tests
    @computed get series(): ScatterSeries[] {
        return Object.entries(
            groupBy(this.allPointsBeforeEndpointsFilter, (p) => p.entityName)
        )
            .map(([entityName, points]) => {
                const seriesPoints = this.compareEndPointsOnly
                    ? excludeUndefined([first(points), last(points)])
                    : points
                const series: ScatterSeries = {
                    seriesName: entityName,
                    label: entityName,
                    color: "#932834", // Default color, used when no color dimension is present
                    size:
                        last(
                            seriesPoints.map((p) => p.size).filter(isNumber)
                        ) ?? 0,
                    points: seriesPoints,
                }
                if (seriesPoints.length) {
                    const keyColor = this.transformedTable.getColorForEntityName(
                        entityName
                    )
                    if (keyColor !== undefined) series.color = keyColor
                    else if (!this.colorColumn.isMissing) {
                        const colorValue = last(
                            series.points.map((point) => point.color)
                        )
                        const color = this.colorScale.getColor(colorValue)
                        if (color !== undefined) {
                            series.color = color
                            series.isScaleColor = true
                        }
                    }
                    const sizes = series.points.map((v) => v.size)
                    series.size = last(sizes.filter(isNumber)) ?? 0
                }
                return series
            })
            .filter((series) => series.points.length > 0)
    }
}
