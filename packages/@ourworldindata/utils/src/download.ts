import { formatValue } from "./formatValue.js"

export const SERVER_SIDE_DOWNLOAD_HELP_TEXT =
    "Download the data shown in this chart as a ZIP file containing a CSV " +
    "file, metadata in JSON format, and a README. The CSV file can be opened " +
    "in Excel, Google Sheets, and other data analysis tools."

// Shown only where a complete-dataset download is on offer. The sources named
// elsewhere on the page describe the indicators behind the current view, but
// the package spans every view, so it can draw on providers that aren't listed
// there -- point at the file inside it that names all of them.
//
// "Full dataset" is the user-facing name for the package everywhere it's
// offered; the code keeps calling it the complete dataset, matching ETL.
export const COMPLETE_DATASET_SOURCES_HELP_TEXT =
    "The full dataset covers more indicators than this chart, and its " +
    "README lists the sources for all of them."

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

/**
 * Code examples for the complete-dataset Parquet. A different set of tools from
 * the chart-scoped CSV examples: Excel, Sheets and Stata are absent because
 * none of them read Parquet, and a table this wide isn't a spreadsheet job.
 */
export function makeCompleteDatasetCodeExamples(
    parquetUrl: string,
    metadataUrl: string
): Record<string, string> {
    return {
        "Python with Pandas": `import pandas as pd
import requests

# Fetch the data (pip install pyarrow)
df = pd.read_parquet("${parquetUrl}")

# Fetch the metadata
metadata = requests.get("${metadataUrl}").json()`,
        // read_parquet() takes a local path, not an HTTP URL, so the file has
        // to be downloaded first.
        R: `library(arrow)
library(jsonlite)

# Fetch the data
path <- tempfile(fileext = ".parquet")
download.file("${parquetUrl}", path, mode = "wb")
df <- read_parquet(path)

# Fetch the metadata
metadata <- fromJSON("${metadataUrl}")`,
    }
}

export function makeNumberOfRowsSnippet(numRows: number | undefined): string {
    if (numRows === undefined) return ""
    if (numRows <= 0) return " (empty)"
    if (numRows === 1) return " (1 row)"
    return ` (${formatValue(numRows, { numDecimalPlaces: 0 })} rows)`
}

export function formatFileSize(bytes: number): string {
    const format = (value: number): string =>
        value.toFixed(1).replace(/\.0$/, "")
    if (bytes >= 1e9) return `${format(bytes / 1e9)} GB`
    if (bytes >= 1e6) return `${format(bytes / 1e6)} MB`
    if (bytes >= 1e3) return `${format(bytes / 1e3)} kB`
    return `${bytes} B`
}

export function makeFullDownloadDescription(
    numRows: number | undefined
): string {
    // "Entities and time points" rather than "countries and years": charts can
    // plot non-country entities and daily data, so the concrete words would be
    // wrong for some of them. The added "for this chart's indicators" is what
    // separates this from the complete-dataset download, which lifts exactly
    // that restriction.
    return `Includes all entities and time points for this chart's indicators${makeNumberOfRowsSnippet(
        numRows
    )}`
}

export function makeCompleteDatasetDescription({
    rowCount,
    indicatorCount,
    sizeBytes,
}: {
    rowCount?: number
    indicatorCount?: number
    sizeBytes?: number
}): string {
    const details = [
        indicatorCount !== undefined
            ? `${formatValue(indicatorCount, { numDecimalPlaces: 0 })} ${
                  indicatorCount === 1 ? "indicator" : "indicators"
              }`
            : undefined,
        rowCount !== undefined && rowCount > 0
            ? `${formatValue(rowCount, { numDecimalPlaces: 0 })} rows`
            : undefined,
        sizeBytes !== undefined ? formatFileSize(sizeBytes) : undefined,
    ].filter((snippet) => snippet !== undefined)
    const detailsSnippet = details.length ? ` (${details.join(", ")})` : ""
    // Spells out "the ones in this chart" rather than leaning on an elided
    // "this chart's": this is the first option offered, so nothing above it has
    // introduced the chart's own indicators yet.
    return `Includes every indicator in this dataset, not just the ones in this chart${detailsSnippet}`
}

export function makeFilteredDownloadDescription({
    visibleIn = "chart",
    numRows,
}: {
    visibleIn?: string
    numRows: number | undefined
}): string {
    // Same two nouns as the chart-data description above: these two downloads
    // differ on exactly the entity and time axes, so naming them in both makes
    // "all" versus "only what's visible" the only thing that changes.
    return `Includes only the entities and time points currently visible in the ${visibleIn}${makeNumberOfRowsSnippet(
        numRows
    )}`
}
