import { parseDelimited } from "coreTable/CoreTableUtils"

export const getRequiredChartIds = (code: string) =>
    parseDelimited(code)
        .map((row: any) => parseInt(row.chartId!))
        .filter((id) => !isNaN(id))

const delimitedToMatrix = (
    delimited: string,
    rowDelimiter = "\n",
    columnDelimiter = "\t"
) => delimited.split(rowDelimiter).map((line) => line.split(columnDelimiter))

export const tsvToMatrix = delimitedToMatrix
