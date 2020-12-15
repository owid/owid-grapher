export const DEFAULT_ROW_DELIMITER = "..."
export const DEFAULT_COLUMN_DELIMITER = "~"
const DEFAULT_COLUMN_DELIMITER_ENCODED = "%7E"
export class Patch {
    object: any
    uriEncodedString: string
    private rowDelimiter: string
    private columnDelimiter: string
    constructor(
        strOrObjLiteral: string | any = {},
        rowDelimiter = DEFAULT_ROW_DELIMITER,
        columnDelimiter = DEFAULT_COLUMN_DELIMITER
    ) {
        this.rowDelimiter = rowDelimiter
        this.columnDelimiter = columnDelimiter
        this.object =
            typeof strOrObjLiteral === "string"
                ? this.fromString(strOrObjLiteral)
                : strOrObjLiteral
        this.uriEncodedString = this.toString()
    }

    // Note: assumes that neither no key nor value in obj has a newline or tab character
    private toString() {
        return Object.keys(this.object)
            .map((identifierCell) => {
                const value = this.object[identifierCell]
                const valueCells = value instanceof Array ? value : [value]
                const row = [identifierCell, ...valueCells].map((cell) =>
                    this.encodeCell(cell)
                )
                return row.join(this.columnDelimiter)
            })
            .join(this.rowDelimiter)
    }

    private encodeCell(str?: string) {
        if (str === undefined) return ""
        return encodeURIComponent(
            str.replace(
                new RegExp(this.columnDelimiter, "g"),
                DEFAULT_COLUMN_DELIMITER_ENCODED
            )
        ).replace(/\%20/g, "+")
    }

    private decodeCell(str: string) {
        return decodeURIComponent(
            str
                .replace(/\+/g, "%20")
                .replace(
                    new RegExp(DEFAULT_COLUMN_DELIMITER_ENCODED, "g"),
                    this.columnDelimiter
                )
        )
    }

    private fromString(uriEncodedPatch: string) {
        const patchObj: any = {}
        uriEncodedPatch.split(this.rowDelimiter).forEach((line) => {
            const cells = line.split(this.columnDelimiter)
            const identifierCell = this.decodeCell(cells.shift() as string)
            const values = cells.map((cell) => this.decodeCell(cell))
            patchObj[identifierCell] = values.length > 1 ? values : values[0]
        })
        return patchObj
    }
}
