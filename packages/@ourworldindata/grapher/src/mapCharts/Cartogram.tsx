import { observer } from "mobx-react"
import { ChartInterface, ChartSeries } from "../chart/ChartInterface"
import { autoDetectYColumnSlugs } from "../chart/ChartUtils.js"
import { ChartManager } from "../chart/ChartManager"
import React from "react"
import {
    EntityCode,
    OwidTable,
    OwidTableSlugs,
} from "@ourworldindata/core-table"
import { action, computed, observable } from "mobx"
import { NoDataModal } from "../noDataModal/NoDataModal"
import {
    Bounds,
    minBy,
    maxBy,
    range,
    ColumnSlug,
    isPresent,
    DEFAULT_BOUNDS,
    flatten,
    HorizontalAlign,
    getRelativeMouse,
    PrimitiveType,
} from "@ourworldindata/utils"
import { CartogramData2020 } from "./Cartogram2020"
import Papa from "papaparse"
import { Patterns, SeriesName } from "../core/GrapherConstants"
import { MapConfig } from "./MapConfig.js"
import { CoreColumn } from "@ourworldindata/core-table"
import {
    CategoricalBin,
    ColorScale,
    ColorScaleBin,
    ColorScaleConfig,
    NumericBin,
} from "../index.js"
import {
    HorizontalCategoricalColorLegend,
    HorizontalNumericColorLegend,
} from "../horizontalColorLegend/HorizontalColorLegends.js"
import { MapTooltip } from "./MapTooltip.js"
export interface CartogramProps {
    bounds?: Bounds
    manager: CartogramManager
    containerElement?: HTMLDivElement
}

export interface CartogramEntity {
    id: string | number | undefined
    series:
        | CartogramSeries
        | {
              value: string
          }
}
export interface CartogramSeries extends ChartSeries {
    value: number | string
    time: number
}
interface CartogramCsvRowRaw {
    X: string
    Y: string
    CountryCode: string
}

interface CartogramCsvRowParsed {
    X: number
    Y: number
    CountryCode: string
}

export interface CartogramManager extends ChartManager {
    mapColumnSlug?: ColumnSlug
    mapConfig?: MapConfig
}

interface GridLinesForEntity {
    entityCode: string
    horizontalGridLinesTopOfCells: [number, number][]
    verticalGridLinesLeftOfCells: [number, number][]
}

@observer
export class Cartogram
    extends React.Component<CartogramProps>
    implements ChartInterface
{
    private dropNonMapEntities(table: OwidTable): OwidTable {
        const { cartogramCellData } = this
        const countryCodesSet = new Set(
            cartogramCellData.map((row) => row.CountryCode)
        )
        return table.columnFilter(
            OwidTableSlugs.entityCode,
            (value) => countryCodesSet.has(value as string),
            `Filter out all entities except those from the cartogram cells`
        )
    }
    transformTable(table: OwidTable): OwidTable {
        const { cartogramCellData } = this
        if (!table.has(this.mapColumnSlug)) return table
        return this.dropNonMapEntities(table)

            .dropRowsWithErrorValuesForColumn(this.mapColumnSlug)
            .interpolateColumnWithTolerance(
                this.mapColumnSlug,
                this.mapConfig?.timeTolerance
            )
    }
    @observable focusEntity?: string

    @computed get mapColumnSlug(): string {
        return (
            this.manager.mapColumnSlug ??
            autoDetectYColumnSlugs(this.manager)[0]!
        )
    }
    @computed private get mapColumn(): CoreColumn {
        return this.transformedTable.get(this.mapColumnSlug)
    }
    @computed get manager(): CartogramManager {
        return this.props.manager
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed get transformedTable(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }
    @computed private get targetTime(): number | undefined {
        return this.manager.endTime
    }

    @computed get failMessage(): string {
        if (this.mapColumn.isMissing) return "Missing map column"
        return ""
    }
    @computed private get mapColumnUntransformed(): CoreColumn {
        return this.dropNonMapEntities(this.inputTable).get(this.mapColumnSlug)
    }
    @computed get colorScaleColumn(): CoreColumn {
        // Use the table before any transforms to collect all possible values over time.
        // Otherwise the legend changes as you slide the timeline handle.
        return this.mapColumnUntransformed
    }

    @computed get mapConfig(): MapConfig {
        return this.manager.mapConfig || new MapConfig()
    }

    colorScale = new ColorScale(this)

    @computed get colorScaleConfig(): ColorScaleConfig {
        return (
            ColorScaleConfig.fromDSL(this.mapColumn.def) ??
            this.mapConfig.colorScale
        )
    }

    @computed get series(): CartogramSeries[] {
        const { mapColumn, targetTime } = this
        if (mapColumn.isMissing) return []
        if (targetTime === undefined) return []

        return mapColumn.owidRows
            .map((row) => {
                const { entityName, value, time } = row
                const color = this.colorScale.getColor(value) || "red" // todo: color fix
                if (!color) return undefined
                return {
                    seriesName: entityName,
                    time,
                    value,
                    color,
                }
            })
            .filter(isPresent)
    }
    base: React.RefObject<SVGGElement> = React.createRef()
    // @computed get countriesRegionsCsv(): CartogramCsvRowParsed[] {
    //     const csv = countriesRegionsCsv
    //     const raw: CartogramCsvRowRaw[] = Papa.parse(csv, {
    //         header: true,
    //     }).data as CartogramCsvRowRaw[]

    //     const parsed: CartogramCsvRowParsed[] = raw
    //         .map((row) => ({
    //             X: Number.parseInt(row.X, 10),
    //             Y: Number.parseInt(row.Y, 10),
    //             CountryCode: Number.parseInt(row.CountryCode),
    //         }))
    //         .filter(
    //             (row) =>
    //                 row.X !== undefined &&
    //                 !isNaN(row.X) &&
    //                 row.Y !== undefined &&
    //                 !isNaN(row.Y)
    //         )
    //     return parsed
    // }
    @computed get cartogramCellData(): CartogramCsvRowParsed[] {
        const csv = CartogramData2020
        const raw: CartogramCsvRowRaw[] = Papa.parse(csv, {
            header: true,
        }).data as CartogramCsvRowRaw[]

        const parsed: CartogramCsvRowParsed[] = raw
            .map((row) => ({
                X: Number.parseInt(row.X, 10) / 8,
                Y: Number.parseInt(row.Y, 10) / 8,
                CountryCode: row.CountryCode,
            }))
            .filter(
                (row) =>
                    row.X !== undefined &&
                    !isNaN(row.X) &&
                    row.Y !== undefined &&
                    !isNaN(row.Y)
            )
        console.log(
            `parsed csv with ${raw.length} raw rows, ${parsed.length} parsed rows`
        )
        return parsed
    }
    @computed private get gridLinesForEntities(): Map<
        string,
        GridLinesForEntity
    > {
        const gridLinesMap = new Map<string, GridLinesForEntity>()
        const { minX, minY, cartogramGrid } = this

        const getCellAbove = (x: number, y: number): string | undefined =>
            y - 1 >= 0 ? cartogramGrid[y - 1][x] : undefined
        const getCellBelow = (x: number, y: number): string | undefined =>
            y + 1 < cartogramGrid.length ? cartogramGrid[y + 1][x] : undefined
        const getCellToLeft = (x: number, y: number): string | undefined =>
            x - 1 >= 0 ? cartogramGrid[y][x - 1] : undefined
        const getCellToRight = (x: number, y: number): string | undefined =>
            x + 1 < cartogramGrid[y].length
                ? cartogramGrid[y][x + 1]
                : undefined

        for (const cartogramCsvRow of this.cartogramCellData) {
            if (!gridLinesMap.has(cartogramCsvRow.CountryCode))
                gridLinesMap.set(cartogramCsvRow.CountryCode, {
                    entityCode: cartogramCsvRow.CountryCode,
                    horizontalGridLinesTopOfCells: [],
                    verticalGridLinesLeftOfCells: [],
                })
            const gridLines = gridLinesMap.get(cartogramCsvRow.CountryCode)!
            const x = cartogramCsvRow.X - minX
            const y = cartogramCsvRow.Y - minY
            const isAboveSameEntity =
                getCellAbove(x, y) === cartogramCsvRow.CountryCode
            const isBelowSameEntity =
                getCellBelow(x, y) === cartogramCsvRow.CountryCode

            const isToLeftSameEntity =
                getCellToLeft(x, y) === cartogramCsvRow.CountryCode

            const isToRightSameEntity =
                getCellToRight(x, y) === cartogramCsvRow.CountryCode
            if (!isAboveSameEntity)
                gridLines.horizontalGridLinesTopOfCells.push([x, y])
            if (!isBelowSameEntity)
                gridLines.horizontalGridLinesTopOfCells.push([x, y + 1])
            if (!isToLeftSameEntity)
                gridLines.verticalGridLinesLeftOfCells.push([x, y])
            if (!isToRightSameEntity)
                gridLines.verticalGridLinesLeftOfCells.push([x + 1, y])
        }
        return gridLinesMap
    }
    @computed private get seriesMap(): Map<EntityCode, CartogramSeries> {
        // This maps entity ids to series data points - we use entity ids
        // here for now because the cartogram csv stores entityids, not names
        const map = new Map<EntityCode, CartogramSeries>()
        const entityNameToCodeMap = this.inputTable.entityNameToCodeMap
        this.series.forEach((series) => {
            const id = entityNameToCodeMap.get(series.seriesName)
            if (id !== undefined) map.set(id, series)
            else console.warn("Could not resolve name", series.seriesName)
        })
        return map
    }
    @computed get minX(): number {
        return minBy(this.cartogramCellData, (row) => row.X)?.X ?? 0
    }
    @computed get maxX(): number {
        return maxBy(this.cartogramCellData, (row) => row.X)?.X ?? 0
    }
    @computed get minY(): number {
        return minBy(this.cartogramCellData, (row) => row.Y)?.Y ?? 0
    }
    @computed get maxY(): number {
        return maxBy(this.cartogramCellData, (row) => row.Y)?.Y ?? 0
    }
    @computed get cartogramGrid(): string[][] {
        const parsed = this.cartogramCellData
        const { minX, maxX, minY, maxY } = this
        console.log({ minX, maxX, minY, maxY })
        const numColumns = maxX - minX + 1
        const numRows = maxY - minY + 1
        const data: string[][] = []
        const oneRow: string[] = []
        for (const column of range(0, numColumns)) oneRow[column] = ""
        for (const row of range(0, numRows)) {
            data.push([...oneRow])
        }
        console.log(data.length)
        for (const row of parsed) {
            const r = row.Y - minY
            const c = row.X - minX

            data[r][c] = row.CountryCode
        }
        return data
    }

    @computed get legendData(): ColorScaleBin[] {
        return this.colorScale.legendBins
    }

    @computed get equalSizeBins(): boolean | undefined {
        return this.colorScale.config.equalSizeBins
    }

    @computed get numRows(): number {
        return this.cartogramGrid.length
    }

    @computed get numColumns(): number {
        return this.cartogramGrid[0].length
    }
    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }
    @computed get cartogramMapBounds(): Bounds {
        return this.bounds.padBottom(this.legendHeight + 15)
    }
    @computed get hasNumeric(): boolean {
        return this.numericLegendData.length > 1
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        const bins = this.legendData.filter(
            (bin): bin is CategoricalBin =>
                bin instanceof CategoricalBin && !bin.isHidden
        )
        for (const bin of bins)
            if (bin.value === "No data")
                bin.props = {
                    ...bin.props,
                    patternRef: Patterns.noDataPattern,
                }
        return bins
    }

    @computed get hasCategorical(): boolean {
        return this.categoricalLegendData.length > 1
    }

    @computed get numericLegendData(): ColorScaleBin[] {
        if (
            this.hasCategorical ||
            !this.legendData.some(
                (bin) =>
                    (bin as CategoricalBin).value === "No data" && !bin.isHidden
            )
        )
            return this.legendData.filter(
                (bin) => bin instanceof NumericBin && !bin.isHidden
            )

        const bins: ColorScaleBin[] = this.legendData.filter(
            (bin) =>
                (bin instanceof NumericBin || bin.value === "No data") &&
                !bin.isHidden
        )
        for (const bin of bins)
            if (bin instanceof CategoricalBin && bin.value === "No data")
                bin.props = {
                    ...bin.props,
                    patternRef: Patterns.noDataPattern,
                }

        return flatten([bins[bins.length - 1], bins.slice(0, -1)])
    }
    @computed get legendMaxWidth(): number {
        // it seems nice to have just a little bit of
        // extra padding left and right
        return this.bounds.width * 0.95
    }

    @computed get legendX(): number {
        return this.bounds.x + (this.bounds.width - this.legendMaxWidth) / 2
    }

    @computed get legendHeight(): number {
        return this.categoryLegendHeight + this.numericLegendHeight + 10
    }

    @computed get numericLegendHeight(): number {
        return this.numericLegend ? this.numericLegend.height : 0
    }

    @computed get categoryLegend():
        | HorizontalCategoricalColorLegend
        | undefined {
        return this.categoricalLegendData.length > 1
            ? new HorizontalCategoricalColorLegend({ manager: this })
            : undefined
    }
    @computed get categoryLegendHeight(): number {
        return this.categoryLegend ? this.categoryLegend.height + 5 : 0
    }

    @computed get numericLegend(): HorizontalNumericColorLegend | undefined {
        return this.numericLegendData.length > 1
            ? new HorizontalNumericColorLegend({ manager: this })
            : undefined
    }

    @computed get categoryLegendY(): number {
        const { categoryLegend, bounds, categoryLegendHeight } = this

        if (categoryLegend) return bounds.bottom - categoryLegendHeight
        return 0
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.center
    }

    @observable tooltipTarget?: { x: number; y: number; featureId: string }
    @computed get entityCodeToNameMap(): Map<string, string> {
        return this.transformedTable.entityCodeToNameMap
    }

    @action.bound onMapMouseOver(code: string, ev: React.MouseEvent): void {
        this.focusEntity = code
        const { entityCodeToNameMap } = this
        console.log("hovering over", code)

        const { containerElement } = this.props
        if (!containerElement) return

        const mouse = getRelativeMouse(containerElement, ev)
        const entityName = entityCodeToNameMap.get(code)
        console.log("mouse coordinates retrieved")
        if (!entityName) console.warn("Entity name not found", code)
        if (code !== undefined)
            this.tooltipTarget = {
                x: mouse.x,
                y: mouse.y,
                featureId: entityName!,
            }
    }
    @computed private get formatTooltipValue(): (d: number | string) => string {
        const { mapConfig, mapColumn, colorScale } = this

        return (d: PrimitiveType): string => {
            if (mapConfig.tooltipUseCustomLabels) {
                // Find the bin (and its label) that this value belongs to
                const bin = colorScale.getBinForValue(d)
                const label = bin?.label
                if (label !== undefined && label !== "") return label
            }
            return mapColumn?.formatValueLong(d) ?? ""
        }
    }

    @action.bound onMapMouseLeave(): void {
        this.focusEntity = undefined
        this.tooltipTarget = undefined
    }
    @computed get numericLegendY(): number {
        const {
            numericLegend,
            numericLegendHeight,
            bounds,
            categoryLegendHeight,
        } = this

        if (numericLegend)
            return (
                bounds.bottom - categoryLegendHeight - numericLegendHeight - 4
            )
        return 0
    }

    renderMapLegend(): JSX.Element {
        const { numericLegend, categoryLegend } = this

        return (
            <g>
                {numericLegend && (
                    <HorizontalNumericColorLegend manager={this} />
                )}
                {categoryLegend && (
                    <HorizontalCategoricalColorLegend manager={this} />
                )}
            </g>
        )
    }
    render(): JSX.Element {
        const { bounds } = this.props
        const {
            numRows,
            numColumns,
            cartogramGrid,
            seriesMap,
            tooltipTarget,
            focusEntity,
            entityCodeToNameMap,
            gridLinesForEntities,
        } = this
        const x = bounds!.x
        const y = bounds!.y
        const width = bounds!.width
        const height = bounds!.height
        const cellWidth = (width - x) / numColumns
        const cellHeight = (height - y) / numRows
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.failMessage}
                />
            )

        const rects = cartogramGrid.map((row, rowIndex) => {
            return row.map((column, colIndex) => {
                const colorFromScale = seriesMap.get(column)?.color
                // const fillColor =
                //     entityCodeToNameMap.get(column) === focusEntity
                //         ? "rgb(255,0,0,1)" // color(colorFromScale!)?.brighter(0.6).toString()
                //         : colorFromScale
                return column !== "" ? (
                    <rect
                        key={`${rowIndex}-${colIndex}`}
                        x={x + cellWidth * colIndex}
                        y={y + cellHeight * rowIndex}
                        width={cellWidth}
                        height={cellHeight}
                        fill={colorFromScale}
                        onMouseEnter={(ev): void =>
                            this.onMapMouseOver(column, ev)
                        }
                        onMouseLeave={this.onMapMouseLeave}
                    />
                ) : (
                    <></>
                )
            })
        })

        const outlines = [...gridLinesForEntities.values()].map(
            (linesForEntity) => {
                const horizontal =
                    linesForEntity.horizontalGridLinesTopOfCells.map((cell) => {
                        const linex = cell[0]
                        const liney = cell[1]
                        return (
                            <line
                                key={`h${linex}-${liney}`}
                                x1={x + linex * cellWidth}
                                x2={x + (linex + 1) * cellWidth}
                                y1={y + liney * cellHeight}
                                y2={y + liney * cellHeight}
                                stroke="#444"
                                opacity={0.5}
                            />
                        )
                    })
                const vertical =
                    linesForEntity.verticalGridLinesLeftOfCells.map((cell) => {
                        const linex = cell[0]
                        const liney = cell[1]
                        return (
                            <line
                                key={`h${linex}-${liney}`}
                                x1={x + linex * cellWidth}
                                x2={x + linex * cellWidth}
                                y1={y + liney * cellHeight}
                                y2={y + (liney + 1) * cellHeight}
                                stroke="#444"
                                opacity={0.5}
                            />
                        )
                    })
                return (
                    <g key={`${linesForEntity.entityCode}`}>
                        {horizontal}
                        {vertical}
                    </g>
                )
            }
        )

        return (
            <g ref={this.base} className="mapTab">
                <rect
                    x={bounds!.x}
                    y={bounds!.y}
                    width={bounds!.width}
                    height={bounds!.height}
                    fill="rgba(255,255,255,0)"
                    opacity={0}
                    key={"bg"}
                />
                <g key={"cells"}>{rects}</g>
                {this.renderMapLegend()}
                {outlines}
                {tooltipTarget && (
                    <MapTooltip
                        entityName={tooltipTarget?.featureId}
                        timeSeriesTable={this.inputTable}
                        formatValue={this.formatTooltipValue}
                        isEntityClickable={false}
                        tooltipTarget={tooltipTarget}
                        manager={this.manager}
                        colorScaleManager={this}
                        targetTime={this.targetTime}
                    />
                )}
            </g>
        )
    }
}
