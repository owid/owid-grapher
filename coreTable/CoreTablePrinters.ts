type CellFormatter = (str: string, rowIndex: number, colIndex: number) => any

// Output a pretty table for consles
export const toAlignedTextTable = (
    header: string[],
    rows: any[],
    maxCharactersPerColumn: number = 120,
    alignRight = true
) => {
    // Set initial column widths
    const widths = header.map((col) =>
        col.length > maxCharactersPerColumn
            ? maxCharactersPerColumn
            : col.length
    )

    // Expand column widths if needed
    rows.forEach((row) => {
        header.forEach((slug, index) => {
            const cellValue = row[slug]
            if (!cellValue) return
            const length = cellValue.toString().length
            if (length > widths[index])
                widths[index] =
                    length > maxCharactersPerColumn
                        ? maxCharactersPerColumn
                        : length
        })
    })

    const cellFn = (cellText: string, row: number, col: number) => {
        const width = widths[col]
        // Strip newlines in fixedWidth output
        const cellValue = cellText.toString().replace(/\n/g, "\\n")
        const cellLength = cellValue.length
        if (cellLength > width) return cellValue.substr(0, width - 3) + "..."

        const padding = " ".repeat(width - cellLength)
        return alignRight ? padding + cellValue : cellValue + padding
    }
    return toDelimited(" ", header, rows, cellFn)
}

export const toMarkdownTable = (
    slugs: string[],
    rows: any[],
    formatFn?: CellFormatter
) =>
    [
        slugs,
        slugs.map(() => "-"),
        ...rows.map((row) => slugs.map((slug) => row[slug])),
    ]
        .map((row, rowIndex) => {
            const formattedValues = row.map((val, colIndex) =>
                formatFn ? formatFn(val, rowIndex, colIndex) : val
            )
            return `|${formattedValues.join("|")}|`
        })
        .join("\n")

export const toDelimited = (
    delimiter: string,
    columnSlugs: string[],
    rows: any[],
    cellFn?: CellFormatter,
    rowDelimiter = "\n"
) => {
    const skipHeaderRow = 1
    const header = columnSlugs.map((columnName, index) =>
        cellFn ? cellFn(columnName, 0, index) : columnName
    )
    const formattedRows = rows.map((row, rowNumber) =>
        columnSlugs.map((slug, columnIndex) =>
            cellFn
                ? cellFn(row[slug], rowNumber + skipHeaderRow, columnIndex)
                : row[slug]
        )
    )

    return (
        header.join(delimiter) +
        rowDelimiter +
        formattedRows.map((row) => row.join(delimiter)).join(rowDelimiter)
    )
}
