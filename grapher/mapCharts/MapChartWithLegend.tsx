import * as React from "react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    ChoroplethMap,
    GeoFeature,
    MapBracket,
    MapEntity,
} from "grapher/mapCharts/ChoroplethMap"
import {
    CategoricalColorLegend,
    CategoricalColorLegendOptionsProvider,
    NumericColorLegend,
    NumericColorLegendOptionsProvider,
} from "grapher/mapCharts/MapColorLegends"
import {
    findClosestTime,
    flatten,
    getRelativeMouse,
    isString,
} from "grapher/utils/Util"
import { MapProjection } from "./MapProjections"
import { select } from "d3-selection"
import { easeCubic } from "d3-ease"
import { ControlsOverlay } from "grapher/controls/ControlsOverlay"
import { MapTooltip } from "./MapTooltip"
import { ProjectionChooser } from "./ProjectionChooser"
import { ChoroplethMarks } from "./MapConstants"
import { isOnTheMap } from "./EntitiesOnTheMap"
import { EntityName } from "coreTable/CoreTableConstants"
import { MapChartOptionsProvider } from "./MapChartOptionsProvider"
import { MapConfig } from "./MapConfig"
import { ColorScale } from "grapher/color/ColorScale"
import { BASE_FONT_SIZE } from "grapher/core/GrapherConstants"
import { ChartInterface } from "grapher/chart/ChartInterface"
import {
    CategoricalBin,
    ColorScaleBin,
    NumericBin,
} from "grapher/color/ColorScaleBin"
import { TextWrap } from "grapher/text/TextWrap"

const PROJECTION_CHOOSER_WIDTH = 110
const PROJECTION_CHOOSER_HEIGHT = 22

// TODO refactor to use transform pattern, bit too much info for a pure component

interface MapChartWithLegendProps {
    bounds?: Bounds
    options: MapChartOptionsProvider
    containerElement?: HTMLDivElement
}

@observer
export class MapChartWithLegend
    extends React.Component<MapChartWithLegendProps>
    implements
        ChartInterface,
        CategoricalColorLegendOptionsProvider,
        NumericColorLegendOptionsProvider {
    @observable.ref tooltip: React.ReactNode | null = null
    @observable tooltipTarget?: { x: number; y: number; featureId: string }

    @observable focusEntity?: MapEntity
    @observable focusBracket?: MapBracket

    @computed get failMessage() {
        if (!this.options.mapColumn) return "Missing map column"
        return ""
    }

    @computed get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    base: React.RefObject<SVGGElement> = React.createRef()
    @action.bound onMapMouseOver(d: GeoFeature, ev: React.MouseEvent) {
        const datum = d.id === undefined ? undefined : this.marks[d.id]
        this.focusEntity = { id: d.id, datum: datum || { value: "No data" } }

        const { containerElement } = this.props
        if (!containerElement) return

        const mouse = getRelativeMouse(containerElement, ev)
        if (d.id !== undefined)
            this.tooltipTarget = {
                x: mouse.x,
                y: mouse.y,
                featureId: d.id as string,
            }
    }

    @action.bound onMapMouseLeave() {
        this.focusEntity = undefined
        this.tooltipTarget = undefined
    }

    @computed get options() {
        return this.props.options
    }

    @computed get table() {
        return this.options.table
    }

    // Determine if we can go to line chart by clicking on a given map entity
    private isEntityClickable(entityName?: EntityName) {
        if (!this.options.mapIsClickable || !entityName) return false

        return this.table.availableEntityNameSet.has(entityName)
    }

    @action.bound onClick(d: GeoFeature, ev: React.MouseEvent<SVGElement>) {
        const entityName = d.id as EntityName
        if (!this.isEntityClickable(entityName)) return

        if (!ev.shiftKey) {
            this.table.setSelectedEntities([entityName])
            this.options.currentTab = "chart"
        } else this.table.toggleSelection(entityName)
    }

    componentWillUnmount() {
        this.onMapMouseLeave()
        this.onLegendMouseLeave()
    }

    @action.bound onLegendMouseOver(bracket: MapBracket) {
        this.focusBracket = bracket
    }

    @action.bound onLegendMouseLeave() {
        this.focusBracket = undefined
    }

    @computed get mapConfig() {
        return this.options.mapConfig || new MapConfig()
    }

    @action.bound onProjectionChange(value: MapProjection) {
        this.mapConfig.projection = value
    }

    @computed get marks() {
        const { options, mapConfig } = this
        const column = options.mapColumn
        if (!column) return {}
        const endTime = column.endTimelineTime

        if (endTime === undefined || !column) return {}

        const valueByEntityAndTime = column.valueByEntityNameAndTime
        const tolerance = mapConfig.timeTolerance ?? 0
        const entityNames = column.entityNamesUniqArr.filter((name) =>
            isOnTheMap(name)
        )

        const marks: ChoroplethMarks = {}
        const selectedEntityNames = options.table.selectedEntityNameSet

        const customLabels = mapConfig.tooltipUseCustomLabels
            ? this.colorScale.customNumericLabels
            : []

        entityNames.forEach((entity) => {
            const valueByTime = valueByEntityAndTime.get(entity)
            if (!valueByTime) return
            const times = Array.from(valueByTime.keys())
            const time = findClosestTime(times, endTime, tolerance)
            if (time === undefined) return
            const value = valueByTime.get(time)
            if (value === undefined) return

            const color = this.colorScale.getColor(value)
            if (!color) return

            marks[entity] = {
                entity,
                displayValue:
                    customLabels[value as any] ?? column.formatValueLong(value),
                time,
                value,
                isSelected: selectedEntityNames.has(entity),
                color,
                highlightFillColor: color,
            }
        })

        return marks
    }

    @computed get colorScale() {
        const that = this
        return new ColorScale({
            get column() {
                return that.options.mapColumn
            },
            get config() {
                return that.mapConfig.colorScale
            },
            get categoricalValues() {
                // return uniq(this.mappableData.values.filter(isString))
                // return that.options.mapColumn.values || [] // todo: mappable data
                return that.options.mapColumn.parsedValues.filter(isString)
            },
            hasNoDataBin: true,
            defaultBaseColorScheme: "BuGn",
        })
    }

    componentDidMount() {
        select(this.base.current)
            .selectAll("path")
            .attr("data-fill", function () {
                return (this as SVGPathElement).getAttribute("fill")
            })
            .attr("fill", this.colorScale.noDataColor)
            .transition()
            .duration(500)
            .ease(easeCubic)
            .attr("fill", function () {
                return (this as SVGPathElement).getAttribute("data-fill")
            })
            .attr("data-fill", function () {
                return (this as SVGPathElement).getAttribute("fill")
            })
    }

    @computed get projectionChooserBounds() {
        const { bounds } = this
        return new Bounds(
            bounds.width - PROJECTION_CHOOSER_WIDTH + 15 - 3,
            5,
            PROJECTION_CHOOSER_WIDTH,
            PROJECTION_CHOOSER_HEIGHT
        )
    }

    @computed get legendData() {
        return this.colorScale.legendData
    }

    @computed get equalSizeBins() {
        return this.colorScale.config.equalSizeBins
    }

    @computed get legendTitle() {
        return ""
    }

    @computed get focusValue() {
        return this.focusEntity?.datum?.value
    }

    @computed get fontSize() {
        return this.options.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed get numericLegendData() {
        if (
            this.hasCategorical ||
            !this.legendData.some(
                (d) => (d as CategoricalBin).value === "No data" && !d.isHidden
            )
        )
            return this.legendData.filter(
                (l) => l instanceof NumericBin && !l.isHidden
            )

        const bin = this.legendData.filter(
            (l) =>
                (l instanceof NumericBin || l.value === "No data") &&
                !l.isHidden
        )
        return flatten([bin[bin.length - 1], bin.slice(0, -1)])
    }

    @computed get hasNumeric() {
        return this.numericLegendData.length > 1
    }

    @computed get categoricalLegendData() {
        return this.legendData.filter(
            (l) => l instanceof CategoricalBin && !l.isHidden
        ) as CategoricalBin[]
    }

    @computed get hasCategorical() {
        return this.categoricalLegendData.length > 1
    }

    @computed get mainLegendLabel() {
        return new TextWrap({
            maxWidth: this.legendBounds.width,
            fontSize: 0.7 * this.fontSize,
            text: this.legendTitle,
        })
    }

    @computed get numericFocusBracket(): ColorScaleBin | undefined {
        const { focusBracket, focusValue } = this
        const { numericLegendData } = this

        if (focusBracket) return focusBracket

        if (focusValue)
            return numericLegendData.find((bin) => bin.contains(focusValue))

        return undefined
    }

    @computed get categoricalFocusBracket() {
        const { focusBracket, focusValue } = this
        const { categoricalLegendData } = this
        if (focusBracket && focusBracket instanceof CategoricalBin)
            return focusBracket

        if (focusValue)
            return categoricalLegendData.find((bin) => bin.contains(focusValue))

        return undefined
    }

    @computed get legendBounds() {
        return this.bounds.padBottom(15)
    }

    @computed get legendWidth() {
        return this.legendBounds.width * 0.8
    }

    @computed get legendHeight() {
        return (
            this.mainLegendLabel.height +
            this.categoryLegendHeight +
            this.numericLegendHeight +
            10
        )
    }

    @computed get numericLegendHeight() {
        return 5
    }

    @computed get categoryLegendHeight() {
        return 5
    }

    @computed get categoryLegend(): CategoricalColorLegend {
        return new CategoricalColorLegend({ options: this })
    }

    @computed get numericLegend(): NumericColorLegend {
        return new NumericColorLegend({ options: this })
    }

    @computed get legendX() {
        const { bounds, numericLegend, categoryLegend } = this
        if (numericLegend) return bounds.centerX - this.legendWidth / 2

        if (categoryLegend) return bounds.centerX - categoryLegend!.width / 2
        return 0
    }

    @computed get legendY() {
        const {
            bounds,
            numericLegend,
            categoryLegend,
            mainLegendLabel,
            categoryLegendHeight,
        } = this
        if (numericLegend)
            return (
                bounds.bottom -
                mainLegendLabel.height -
                categoryLegendHeight -
                numericLegend!.height -
                4
            )

        if (categoryLegend)
            return bounds.bottom - mainLegendLabel.height - categoryLegendHeight
        return 0
    }

    renderMapLegend() {
        const { bounds, mainLegendLabel, numericLegend, categoryLegend } = this

        return (
            <g className="mapLegend">
                {numericLegend && <NumericColorLegend options={this} />}
                {categoryLegend && <CategoricalColorLegend options={this} />}
                {mainLegendLabel.render(
                    bounds.centerX - mainLegendLabel.width / 2,
                    bounds.bottom - mainLegendLabel.height
                )}
            </g>
        )
    }

    render() {
        const {
            focusBracket,
            focusEntity,
            tooltipTarget,
            projectionChooserBounds,
            marks,
            colorScale,
            mapConfig,
        } = this

        const { projection } = mapConfig

        const tooltipDatum = tooltipTarget
            ? marks[tooltipTarget.featureId]
            : undefined

        return (
            <g ref={this.base} className="mapTab">
                <ChoroplethMap
                    bounds={this.bounds.padBottom(this.legendHeight + 15)}
                    choroplethData={marks}
                    projection={projection}
                    defaultFill={colorScale.noDataColor}
                    onHover={this.onMapMouseOver}
                    onHoverStop={this.onMapMouseLeave}
                    onClick={this.onClick}
                    focusBracket={focusBracket}
                    focusEntity={focusEntity}
                />
                {this.renderMapLegend()}
                <ControlsOverlay id="projection-chooser">
                    <ProjectionChooser
                        bounds={projectionChooserBounds}
                        value={projection}
                        onChange={this.onProjectionChange}
                    />
                </ControlsOverlay>
                {tooltipTarget && (
                    <MapTooltip
                        inputTime={this.options.mapColumn.endTimelineTime}
                        tooltipDatum={tooltipDatum}
                        isEntityClickable={this.isEntityClickable(
                            tooltipTarget?.featureId
                        )}
                        tooltipTarget={tooltipTarget}
                        options={this.options}
                        colorScale={this.colorScale}
                    />
                )}
            </g>
        )
    }
}
