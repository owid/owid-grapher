import { formatValue } from "./formatValue.js"

export const SERVER_SIDE_DOWNLOAD_HELP_TEXT =
    "Download the data shown in this chart as a ZIP file containing a CSV " +
    "file, metadata in JSON format, and a README. The CSV file can be opened " +
    "in Excel, Google Sheets, and other data analysis tools."

export const triggerDownloadFromBlob = (filename: string, blob: Blob): void => {
    const objectUrl = URL.createObjectURL(blob)
    triggerDownloadFromUrl(filename, objectUrl)
    URL.revokeObjectURL(objectUrl)
}

export const triggerDownloadFromUrl = (filename: string, url: string): void => {
    const downloadLink = document.createElement("a")
    downloadLink.setAttribute("href", url)
    downloadLink.setAttribute("download", filename)
    downloadLink.click()
}

export async function downloadImage(
    url: string,
    filename: string
): Promise<void> {
    const response = await fetch(url)
    const blob = await response.blob()
    triggerDownloadFromBlob(filename, blob)
}

export function makeDownloadCodeExamples(
    csvUrl: string,
    metadataUrl: string
): Record<string, string> {
    return {
        "Excel / Google Sheets": `=IMPORTDATA("${csvUrl}")`,
        "Python with Pandas": `import pandas as pd
import requests

# Fetch the data.
df = pd.read_csv("${csvUrl}", storage_options = {'User-Agent': 'Our World In Data data fetch/1.0'})

# Fetch the metadata
metadata = requests.get("${metadataUrl}").json()`,
        R: `library(jsonlite)

# Fetch the data
df <- read.csv("${csvUrl}")

# Fetch the metadata
metadata <- fromJSON("${metadataUrl}")`,
        Stata: `import delimited "${csvUrl}", encoding("utf-8") clear`,
    }
}

export function makeNumberOfRowsSnippet(numRows: number | undefined): string {
    if (numRows === undefined) return ""
    if (numRows <= 0) return " (empty)"
    if (numRows === 1) return " (1 row)"
    return ` (${formatValue(numRows, { numDecimalPlaces: 0 })} rows)`
}

export function makeFullDownloadDescription(
    numRows: number | undefined
): string {
    return `Includes all entities and time points${makeNumberOfRowsSnippet(
        numRows
    )}`
}

export function makeFilteredDownloadDescription({
    visibleIn = "chart",
    numRows,
}: {
    visibleIn?: string
    numRows: number | undefined
}): string {
    return `Includes only the entities and time points currently visible in the ${visibleIn}${makeNumberOfRowsSnippet(
        numRows
    )}`
}
