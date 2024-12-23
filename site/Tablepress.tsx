import ReactDOMServer from "react-dom/server.js"

interface Cell {
    data: string
    colspan: number
    rowspan: number
}

function cell(data?: string) {
    return {
        data: data || "",
        colspan: 1,
        rowspan: 1,
    }
}

const ROWSPAN_TOKEN = "#rowspan#"
const COLSPAN_TOKEN = "#colspan#"

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
            } else if (data === COLSPAN_TOKEN) {
                let j = c - 1
                while (j >= 0 && row[j] === COLSPAN_TOKEN) {
                    j--
                }
                if (j >= 0) {
                    resultRow[j].colspan++
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

export const renderTablePress = (table: string[][]) => {
    return ReactDOMServer.renderToStaticMarkup(<Tablepress data={table} />)
}

export default function Tablepress(props: { data: string[][] }) {
    const { data } = props
    const table = parseTable(data)
    const [headerRow, ...body] = table
    return (
        <table>
            <thead>
                <tr>
                    {headerRow.map((cell, i) => (
                        <th
                            key={i}
                            scope="col"
                            colSpan={cell.colspan}
                            dangerouslySetInnerHTML={{ __html: cell.data }}
                        />
                    ))}
                </tr>
            </thead>
            <tbody>
                {body.map((row, i) => (
                    <tr key={i}>
                        {row.map((cell, j) => (
                            <td
                                key={j}
                                colSpan={cell.colspan}
                                rowSpan={cell.rowspan}
                                dangerouslySetInnerHTML={{
                                    __html: cell.data,
                                }}
                            />
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}
