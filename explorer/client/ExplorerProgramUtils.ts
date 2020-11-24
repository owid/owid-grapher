import { parseDelimited } from "coreTable/CoreTableUtils"

export const getRequiredGrapherIds = (code: string) =>
    parseDelimited(code)
        .map((row: any) => parseInt(row.grapherId!))
        .filter((id) => !isNaN(id))

export const DEFAULT_COLUMN_DELIMITER = "="
export const DEFAULT_ROW_DELIMITER = "~"

// Note: assumes that neither no key nor value in obj has a newline or tab character
export const objectToPatch = (
    obj: any,
    rowDelimiter = DEFAULT_ROW_DELIMITER,
    columnDelimiter = DEFAULT_COLUMN_DELIMITER
) =>
    Object.keys(obj)
        .map((key) =>
            [encodeURIComponent(key), encodeURIComponent(obj[key])].join(
                columnDelimiter
            )
        )
        .join(rowDelimiter)

export const objectFromPatch = (
    patch: string,
    rowDelimiter = DEFAULT_ROW_DELIMITER,
    columnDelimiter = DEFAULT_COLUMN_DELIMITER
) => {
    const obj: any = {}
    patch.split(rowDelimiter).forEach((line) => {
        line = line.trim()
        if (!line) return
        const words = line.split(columnDelimiter)
        const key = words.shift() as string
        obj[key] = words.join(columnDelimiter)
    })
    return obj
}
