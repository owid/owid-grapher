import * as React from "react"
import { intersection, without, uniq, isEmpty, last } from "grapher/utils/Util"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import {
    LabelledSlopes,
    SlopeChartSeries,
    SlopeChartValue,
    SlopeProps,
} from "./LabelledSlopes"
import { NoDataOverlay } from "grapher/chart/NoDataOverlay"
import {
    VerticalColorLegend,
    VerticalColorLegendOptionsProvider,
} from "grapher/verticalColorLegend/VerticalColorLegend"
import { ColorScale } from "grapher/color/ColorScale"
import { BASE_FONT_SIZE, Time } from "grapher/core/GrapherConstants"
import { ChartInterface } from "grapher/chart/ChartInterface"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"

@observer
export class SlopeChart
    extends React.Component<{
        bounds?: Bounds
        options: ChartOptionsProvider
    }>
    implements ChartInterface, VerticalColorLegendOptionsProvider {
    // currently hovered individual series key
    @observable hoverKey?: string
    // currently hovered legend color
    @observable hoverColor?: string

    @computed get options() {
        return this.props.options
    }

    @computed.struct get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get fontSize() {
        return this.options.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed get colorBins() {
        return this.colorScale.legendData.filter((bin) =>
            this.colorsInUse.includes(bin.color)
        )
    }

    @computed get maxLegendWidth() {
        return this.sidebarMaxWidth
    }

    @action.bound onSlopeMouseOver(slopeProps: SlopeProps) {
        this.hoverKey = slopeProps.entityName
    }

    @action.bound onSlopeMouseLeave() {
        this.hoverKey = undefined
    }

    @action.bound onSlopeClick() {
        const { options, hoverKey } = this
        if (
            options.addCountryMode === "disabled" ||
            !options.addCountryMode ||
            hoverKey === undefined
        ) {
            return
        }

        this.options.table.toggleSelection(hoverKey)
    }

    @action.bound onLegendMouseOver(color: string) {
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.hoverColor = undefined
    }

    @computed private get selectedKeys() {
        return this.options.table.selectedEntityNames
    }

    // When the color legend is clicked, toggle selection fo all associated keys
    @action.bound onLegendClick() {
        const { options, hoverColor } = this
        if (
            options.addCountryMode === "disabled" ||
            !options.addCountryMode ||
            hoverColor === undefined
        )
            return

        const keysToToggle = this.marks
            .filter((g) => g.color === hoverColor)
            .map((g) => g.entityName)
        const allKeysActive =
            intersection(keysToToggle, this.selectedKeys).length ===
            keysToToggle.length
        if (allKeysActive)
            this.options.table.setSelectedEntities(
                without(this.selectedKeys, ...keysToToggle)
            )
        else
            this.options.table.setSelectedEntities(
                this.selectedKeys.concat(keysToToggle)
            )
    }

    // Colors on the legend for which every matching group is focused
    @computed get focusColors() {
        const { colorsInUse } = this
        return colorsInUse.filter((color) => {
            const matchingKeys = this.marks
                .filter((g) => g.color === color)
                .map((g) => g.entityName)
            return (
                intersection(matchingKeys, this.selectedKeys).length ===
                matchingKeys.length
            )
        })
    }

    @computed get focusKeys() {
        return this.selectedKeys
    }

    // All currently hovered group keys, combining the legend and the main UI
    @computed.struct get hoverKeys() {
        const { hoverColor, hoverKey } = this

        const hoverKeys =
            hoverColor === undefined
                ? []
                : uniq(
                      this.marks
                          .filter((g) => g.color === hoverColor)
                          .map((g) => g.entityName)
                  )

        if (hoverKey !== undefined) hoverKeys.push(hoverKey)

        return hoverKeys
    }

    // Colors currently on the chart and not greyed out
    @computed get activeColors(): string[] {
        const { hoverKeys, focusKeys } = this
        const activeKeys = hoverKeys.concat(focusKeys)

        if (activeKeys.length === 0)
            // No hover or focus means they're all active by default
            return uniq(this.marks.map((g) => g.color))

        return uniq(
            this.marks
                .filter((g) => activeKeys.indexOf(g.entityName) !== -1)
                .map((g) => g.color)
        )
    }

    // Only show colors on legend that are actually in use
    @computed get colorsInUse() {
        return uniq(this.marks.map((g) => g.color))
    }

    @computed get sidebarMaxWidth() {
        return this.bounds.width * 0.5
    }

    @computed get sidebarMinWidth() {
        return 100
    }

    @computed private get legendWidth() {
        return new VerticalColorLegend({ options: this }).width
    }

    @computed.struct get sidebarWidth() {
        const { sidebarMinWidth, sidebarMaxWidth, legendWidth } = this
        return Math.max(Math.min(legendWidth, sidebarMaxWidth), sidebarMinWidth)
    }

    // correction is to account for the space taken by the legend
    @computed get innerBounds() {
        const { sidebarWidth, showLegend } = this

        return showLegend
            ? this.bounds.padRight(sidebarWidth + 20)
            : this.bounds
    }

    // verify the validity of data used to show legend
    // this is for backwards compatibility with charts that were added without legend
    // eg: https://ourworldindata.org/grapher/mortality-rate-improvement-by-cohort
    @computed get showLegend() {
        const { colorsInUse } = this
        const { legendData } = this.colorScale
        return legendData.some((bin) => colorsInUse.includes(bin.color))
    }

    render() {
        if (this.failMessage)
            return (
                <NoDataOverlay
                    options={this.options}
                    bounds={this.props.bounds}
                    message={this.failMessage}
                />
            )

        const { options } = this.props
        const { marks, focusKeys, hoverKeys, innerBounds, showLegend } = this

        return (
            <g>
                <LabelledSlopes
                    options={options}
                    bounds={innerBounds}
                    yColumn={this.yColumn!}
                    data={marks}
                    focusKeys={focusKeys}
                    hoverKeys={hoverKeys}
                    onMouseOver={this.onSlopeMouseOver}
                    onMouseLeave={this.onSlopeMouseLeave}
                    onClick={this.onSlopeClick}
                />
                {showLegend ? (
                    <VerticalColorLegend options={this} />
                ) : (
                    <div></div>
                )}
            </g>
        )
    }

    @computed get legendY() {
        return this.bounds.top
    }

    @computed get legendX(): number {
        return this.bounds.right - this.sidebarWidth
    }

    @computed get failMessage() {
        if (!this.yColumn) return "Missing Y column"
        else if (isEmpty(this.marks)) return "No matching data"
        return ""
    }

    @computed get colorScale() {
        const colorColumn = this.colorColumn
        return new ColorScale({
            column: this.colorColumn,
            get config() {
                return {} as any // that.grapher.colorScale
            },
            defaultBaseColorScheme: "continents",
            get categoricalValues() {
                return colorColumn?.sortedUniqNonEmptyStringVals ?? []
            },
            hasNoDataBin: false,
        })
    }

    @computed get availableTimes(): Time[] {
        return this.yColumn?.timesUniq || []
    }

    @computed private get yColumn() {
        return this.options.yColumn!
    }

    @computed private get colorColumn() {
        return this.options.colorColumn!
    }

    // helper method to directly get the associated color value given an Entity
    // dimension data saves color a level deeper. eg: { Afghanistan => { 2015: Asia|Color }}
    // this returns that data in the form { Afghanistan => Asia }
    @computed private get colorByEntity(): Map<string, string | undefined> {
        const { colorScale, colorColumn } = this
        const colorByEntity = new Map<string, string | undefined>()

        if (colorColumn)
            colorColumn.valueByEntityNameAndTime.forEach(
                (timeToColorMap, entity) => {
                    const values = Array.from(timeToColorMap.values())
                    const key = last(values)
                    colorByEntity.set(entity, colorScale.getColor(key))
                }
            )

        return colorByEntity
    }

    // helper method to directly get the associated size value given an Entity
    // dimension data saves size a level deeper. eg: { Afghanistan => { 1990: 1, 2015: 10 }}
    // this returns that data in the form { Afghanistan => 1 }
    @computed private get sizeByEntity(): Map<string, any> {
        const sizeCol = this.options.sizeColumn
        const sizeByEntity = new Map<string, any>()

        if (sizeCol)
            sizeCol.valueByEntityNameAndTime.forEach(
                (timeToSizeMap, entity) => {
                    const values = Array.from(timeToSizeMap.values())
                    sizeByEntity.set(entity, values[0]) // hack: default to the value associated with the first time
                }
            )

        return sizeByEntity
    }

    @computed get marks() {
        const column = this.yColumn
        if (!column) return []

        const { colorByEntity, sizeByEntity } = this
        const { minTime, maxTime } = column

        const table = this.options.table

        return column.entityNamesUniqArr
            .map((entityName) => {
                const values: SlopeChartValue[] = []

                const yValues =
                    column.valueByEntityNameAndTime.get(entityName)! || []

                yValues.forEach((value, time) => {
                    if (time !== minTime && time !== maxTime) return

                    values.push({
                        x: time,
                        y: typeof value === "string" ? parseInt(value) : value,
                    })
                })

                return {
                    entityName,
                    label: entityName,
                    color:
                        table.getColorForEntityName(entityName) ||
                        colorByEntity.get(entityName) ||
                        "#ff7f0e",
                    size: sizeByEntity.get(entityName) || 1,
                    values,
                } as SlopeChartSeries
            })
            .filter((d) => d.values.length >= 2)
    }
}
