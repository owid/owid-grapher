export const DEFAULT_ROW_DELIMITER = "-and-"
export const DEFAULT_COLUMN_DELIMITER = "-is-"

export class Patch {
    object: any
    uriEncodedString: string
    private rowDelimiter: string
    private columnDelimiter: string
    constructor(
        strOrObjLiteral: string | any,
        rowDelimiter = DEFAULT_ROW_DELIMITER,
        columnDelimiter = DEFAULT_COLUMN_DELIMITER
    ) {
        this.rowDelimiter = rowDelimiter
        this.columnDelimiter = columnDelimiter
        this.object =
            (typeof strOrObjLiteral === "string"
                ? this.fromString(strOrObjLiteral)
                : strOrObjLiteral) ?? {}
        this.uriEncodedString = encodeURIComponent(
            this.toString(this.object)
        ).replace(/\%20/g, "+")
    }

    // Note: assumes that neither no key nor value in obj has a newline or tab character
    private toString(obj: any = {}) {
        return Object.keys(obj)
            .map((key) => [key, obj[key]].join(this.columnDelimiter))
            .join(this.rowDelimiter)
    }

    private fromString(uriEncodedPatch: string) {
        const obj: any = {}
        const str = decodeURIComponent(uriEncodedPatch.replace(/\+/g, "%20"))
        str.split(this.rowDelimiter).forEach((line) => {
            line = line.trim()
            if (!line) return
            const words = line.split(this.columnDelimiter)
            const key = words.shift() as string
            obj[key] = words.join(this.columnDelimiter)
        })
        return obj
    }
}
