import { observer } from "mobx-react"
import { ChartInterface, ChartSeries } from "../chart/ChartInterface.js"
import { ChartManager } from "../chart/ChartManager.js"
import React from "react"
import { OwidTable, rowsToMatrix } from "@ourworldindata/core-table"
import { computed } from "mobx"
import { isOnTheMap } from "./EntitiesOnTheMap.js"
import { NoDataModal } from "../noDataModal/NoDataModal.js"
import { Bounds, minBy, maxBy, range, min } from "@ourworldindata/utils"
import { CartogramData1950 } from "./Cartogram1950.js"
import Papa from "papaparse"
export interface CartogramProps {
    bounds?: Bounds
    manager: ChartManager
}

interface CartogramCsvRowRaw {
    X: string
    Y: string
    CountryCode: string
}

interface CartogramCsvRowParsed {
    X: number
    Y: number
    CountryCode: number
}

@observer
export class Cartogram
    extends React.Component<CartogramProps>
    implements ChartInterface
{
    transformTable(table: OwidTable): OwidTable {
        return table
    }

    @computed get manager(): ChartManager {
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

    @computed get failMessage(): string {
        return ""
    }

    @computed get series(): ChartSeries[] {
        return []
    }
    base: React.RefObject<SVGGElement> = React.createRef()
    @computed get cartogramGrid(): number[][] {
        const csv = CartogramData1950
        const raw: CartogramCsvRowRaw[] = Papa.parse(csv, {
            header: true,
        }).data as CartogramCsvRowRaw[]

        const parsed: CartogramCsvRowParsed[] = raw
            .map((row) => ({
                X: Number.parseInt(row.X, 10),
                Y: Number.parseInt(row.Y, 10),
                CountryCode: Number.parseInt(row.CountryCode),
            }))
            .filter(
                (row) =>
                    row.X !== undefined &&
                    !isNaN(row.X) &&
                    row.Y !== undefined &&
                    !isNaN(row.Y)
            )
        const minX = minBy(parsed, (row) => row.X)?.X ?? 0
        const maxX = maxBy(parsed, (row) => row.X)?.X ?? 0
        const minY = minBy(parsed, (row) => row.Y)?.Y ?? 0
        const maxY = maxBy(parsed, (row) => row.Y)?.Y ?? 0
        console.log({ minX, maxX, minY, maxY })
        const numColumns = maxX - minX + 1
        const numRows = maxY - minY + 1
        const data = []
        const oneRow = []
        for (const column of range(0, numColumns)) oneRow[column] = 0
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

    @computed get numRows(): number {
        return this.cartogramGrid.length
    }

    @computed get numColumns(): number {
        return this.cartogramGrid[0].length
    }

    render(): JSX.Element {
        const { bounds } = this.props
        const { numRows, numColumns, cartogramGrid } = this
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
            return row.map((column, colIndex) =>
                column !== 0 ? (
                    <rect
                        key={`${rowIndex}-${colIndex}`}
                        x={x + cellWidth * colIndex}
                        y={y + cellHeight * rowIndex}
                        width={cellWidth * 7}
                        height={cellHeight * 7}
                        fill="rgba(255,0,0,1)"
                    />
                ) : (
                    <></>
                )
            )
        })

        return (
            <g ref={this.base} className="mapTab">
                <rect
                    x={bounds!.x}
                    y={bounds!.y}
                    width={bounds!.width}
                    height={bounds!.height}
                    fill="rgba(255,255,255,0)"
                    opacity={0}
                />
                <g>{rects}</g>
            </g>
        )
    }
}
