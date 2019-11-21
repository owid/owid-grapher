import * as React from "react"

interface Cell {
    data: string
    colspan: number
    rowspan: number
}

function cell(data?: string) {
    return {
        data: data || "",
        colspan: 1,
        rowspan: 1
    }
}

const ROWSPAN_TOKEN = "#rowspan#"

function parseTable(table: string[][]): Cell[][] {
    const resultTable: Cell[][] = []
    table.forEach((row, r) => {
        const resultRow: Cell[] = []
        row.forEach((data, c) => {
            if (data === ROWSPAN_TOKEN) {
                let i = r - 1
                while (i >= 0 && table[i][c] === ROWSPAN_TOKEN) {
                    i--
                }
                if (i >= 0) {
                    resultTable[i][c].rowspan++
                } else {
                    resultRow.push(cell())
                }
            } else {
                resultRow.push(cell(data))
            }
        })
        resultTable.push(resultRow)
    })
    return resultTable
}

export default function Tablepress(props: { data: string[][] }) {
    const { data } = props
    const table = parseTable(data)
    const [headerRow, ...body] = table
    return (
        <table className="tablepress">
            <thead>
                <tr>
                    {headerRow.map((cell, i) => (
                        <th
                            key={i}
                            dangerouslySetInnerHTML={{ __html: cell.data }}
                        />
                    ))}
                </tr>
            </thead>
            <tbody className="row-hover">
                {body.map((row, i) => (
                    <tr key={i}>
                        {row.map((cell, j) => (
                            <td
                                key={j}
                                colSpan={cell.colspan}
                                rowSpan={cell.rowspan}
                                dangerouslySetInnerHTML={{ __html: cell.data }}
                            />
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}
