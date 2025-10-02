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
