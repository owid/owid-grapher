import * as React from "react"
import { Bounds } from "grapher/utils/Bounds"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    ChoroplethMap,
    GeoFeature,
    MapBracket,
    MapEntity,
} from "grapher/mapCharts/ChoroplethMap"
import { MapColorLegend } from "grapher/mapCharts/MapColorLegend"
import { MapColorLegendView } from "./MapColorLegendView"
import { findClosestTime, getRelativeMouse, isString } from "grapher/utils/Util"
import { MapProjection } from "./MapProjections"
import { select } from "d3-selection"
import { easeCubic } from "d3-ease"
import { ControlsOverlay } from "grapher/controls/ControlsOverlay"
import { MapTooltip } from "./MapTooltip"
import { ProjectionChooser } from "./ProjectionChooser"
import { ChoroplethData, MapDataValue } from "./MapConstants"
import { isOnTheMap } from "./EntitiesOnTheMap"
import { EntityName } from "owidTable/OwidTableConstants"
import { MapChartOptionsProvider } from "./MapChartOptionsProvider"
import { MapConfig } from "./MapConfig"
import { ColorScale } from "grapher/color/ColorScale"
import { BASE_FONT_SIZE } from "grapher/core/GrapherConstants"
import { ChartInterface } from "grapher/chart/ChartInterface"

const PROJECTION_CHOOSER_WIDTH = 110
const PROJECTION_CHOOSER_HEIGHT = 22

// TODO refactor to use transform pattern, bit too much info for a pure component

interface MapChartWithLegendProps {
    bounds: Bounds
    options: MapChartOptionsProvider
    containerElement?: HTMLDivElement
}

@observer
export class MapChartWithLegend
    extends React.Component<MapChartWithLegendProps>
    implements ChartInterface {
    @observable.ref tooltip: React.ReactNode | null = null
    @observable tooltipTarget?: { x: number; y: number; featureId: string }

    @observable focusEntity?: MapEntity
    @observable focusBracket?: MapBracket

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

    @action.bound onLegendMouseOver(d: MapBracket) {
        this.focusBracket = d
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

    // Get values for the current time, without any color info yet
    @computed get valuesByEntity(): { [key: string]: MapDataValue } {
        const { options, mapConfig } = this
        const column = options.mapColumn
        const endTime = column.endTimelineTime

        if (endTime === undefined || !column) return {}

        const valueByEntityAndTime = column.valueByEntityNameAndTime

        const tolerance = mapConfig.timeTolerance ?? 0
        const entityNames = column.entityNamesUniqArr.filter((name) =>
            isOnTheMap(name)
        )

        const result: { [key: string]: MapDataValue } = {}
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
            result[entity] = {
                entity,
                displayValue:
                    customLabels[value as any] ?? column.formatValueLong(value),
                time,
                value,
                isSelected: selectedEntityNames.has(entity),
            }
        })

        return result
    }

    // Get the final data incorporating the binning colors
    @computed get marks() {
        const { valuesByEntity } = this
        const choroplethData: ChoroplethData = {}

        Object.entries(valuesByEntity).forEach(([entity, datum]) => {
            const color = this.colorScale.getColor(datum.value)
            if (color)
                choroplethData[entity] = {
                    ...datum,
                    color,
                    highlightFillColor: color,
                }
        })

        return choroplethData
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
                return that.options.mapColumn.values.filter(isString)
            },
            hasNoDataBin: true,
            defaultBaseColorScheme: "BuGn",
        })
    }

    @computed get mapLegend() {
        const that = this
        return new MapColorLegend({
            get bounds() {
                return that.props.bounds.padBottom(15)
            },
            get legendData() {
                return that.colorScale.legendData
            },
            get equalSizeBins() {
                return that.colorScale.config.equalSizeBins
            },
            get title() {
                return ""
            },
            get focusBracket() {
                return that.focusBracket
            },
            get focusValue() {
                return that.focusEntity?.datum?.value
            },
            get fontSize() {
                return that.options.baseFontSize ?? BASE_FONT_SIZE
            },
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
        const { bounds } = this.props
        return new Bounds(
            bounds.width - PROJECTION_CHOOSER_WIDTH + 15 - 3,
            5,
            PROJECTION_CHOOSER_WIDTH,
            PROJECTION_CHOOSER_HEIGHT
        )
    }

    render() {
        const {
            focusBracket,
            focusEntity,
            mapLegend,
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
                    bounds={this.props.bounds.padBottom(mapLegend.height + 15)}
                    choroplethData={marks}
                    projection={projection}
                    defaultFill={colorScale.noDataColor}
                    onHover={this.onMapMouseOver}
                    onHoverStop={this.onMapMouseLeave}
                    onClick={this.onClick}
                    focusBracket={focusBracket}
                    focusEntity={focusEntity}
                />
                <MapColorLegendView
                    legend={mapLegend}
                    onMouseOver={this.onLegendMouseOver}
                    onMouseLeave={this.onLegendMouseLeave}
                />
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
