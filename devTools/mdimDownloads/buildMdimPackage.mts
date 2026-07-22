/**
 * PROTOTYPE (mdim-downloads project). Grapher-side half of the ETL/grapher
 * hybrid package builder: ETL builds the wide table (it has the data
 * locally, no per-view HTTP fetch needed -- validated across 12 real MDIMs)
 * and stages it + an indicator index to R2. This script picks that up,
 * fetches each distinct indicator's real metadata from the public Data API
 * (cheap -- one call per indicator, deduped, not per view), and reuses
 * grapher's own citation/readme-formatting functions -- not a Python
 * reimplementation -- to build the real metadata.json + readme.md, then
 * zips and uploads the finished package.
 *
 * See mdim-downloads/solution-space/etl-feasibility.md for why this is
 * split this way instead of doing it all in either repo.
 *
 * Usage: npx tsx devTools/mdimDownloads/buildMdimPackage.mts <slug> "<title>"
 */

import { createZip, UncompressedFile } from "littlezipper"
import {
    getCitationShort,
    getCitationLong,
    getAttributionFragmentsFromVariable,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
} from "@ourworldindata/utils"
import {
    getTitle,
    getDescription,
    getKeyDataLines,
    getAttribution,
    getSource,
    getCitationLines,
    getDescriptionLines,
    getSources,
    getDataProcessingLines,
} from "../../functions/_common/readmeTools.js"
import {
    createS3Client,
    saveObjectToR2,
} from "../../serverUtils/r2/R2Helpers.js"
import {
    R2_ENDPOINT,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_REGION,
} from "../../settings/serverSettings.js"

const STAGING_BASE = "https://owid-public.owid.io/data/mdim-downloads-staging"
const FINAL_BUCKET = "owid-public"
const FINAL_BASE_PATH = "data/mdim-downloads"

interface IndicatorEntry {
    wideColumnName: string
    catalogPath: string
    owidVariableId: number
}

// Minimal shape covering every field the reused readmeTools.js functions
// (getTitle/getCitationLines/getKeyDataLines/etc.) actually read off `def` --
// built directly from the public indicator metadata API response, which
// carries the same raw ingredients (origins, presentation, processingLevel)
// as the OwidColumnDef these functions were written against.
function toColumnDef(raw: any): any {
    return {
        ...raw,
        owidProcessingLevel: raw.processingLevel,
        sourceName: raw.source?.name,
    }
}

// getTitle/getCitationLines/getKeyDataLines need a CoreColumn, but only ever
// read .def, .source, .titlePublicOrDisplayName, .unitConversionFactor off
// it -- a real CoreColumn (backed by a live OwidTable) isn't needed to get
// correct output, just an object with those four fields.
function toColumnShim(def: any): any {
    return {
        def,
        source: def.source ?? {},
        titlePublicOrDisplayName: {
            title:
                def.presentation?.titlePublic || def.display?.name || def.name,
            attributionShort: def.presentation?.attributionShort,
            titleVariant: def.presentation?.titleVariant,
        },
        unitConversionFactor: def.display?.conversionFactor,
    }
}

// Mirrors columnReadmeText() in readmeTools.ts exactly (that function isn't
// exported) using the exported sub-functions it's built from -- same output,
// no change to the real download path's code.
function columnReadmeText(col: any): string[] {
    const def = col.def
    const lines: string[] = []
    lines.push("", `## ${getTitle(col)}`)
    lines.push(...getDescription(def))
    lines.push(...getKeyDataLines(def, col))
    lines.push("")
    const attribution = getAttribution(def)
    const source = getSource(attribution, def)
    lines.push(...getCitationLines(def, col))
    lines.push(`Source: ${source}`)
    lines.push(...getDescriptionLines(def, attribution))
    lines.push(...getSources(def))
    lines.push(...getDataProcessingLines(def))
    lines.push("")
    return lines
}

function computeLongColumnName(def: any): string {
    const titlePublic =
        def.presentation?.titlePublic || def.display?.name || def.name
    const { attributionShort, titleVariant } = def.presentation ?? {}
    let title = titlePublic
    if (attributionShort && titleVariant)
        title = `${title} – ${titleVariant} – ${attributionShort}`
    else if (titleVariant) title = `${title} – ${titleVariant}`
    else if (attributionShort) title = `${title} – ${attributionShort}`
    // Disambiguate dimension choices that share the same base title (e.g.
    // "Average years of schooling" for both the "girls" and "boys" views) --
    // display.name already carries the disambiguating value ("Girls", "Both
    // genders") for exactly this reason.
    if (def.display?.name && def.display.name !== titlePublic) {
        title = `${title} (${def.display.name})`
    }
    return title
}

async function fetchIndicatorMetadata(id: number): Promise<any> {
    const res = await fetch(
        `https://api.ourworldindata.org/v1/indicators/${id}.metadata.json`
    )
    if (!res.ok)
        throw new Error(
            `Failed to fetch metadata for indicator ${id}: ${res.status}`
        )
    return res.json()
}

function renameCsvHeader(
    csvText: string,
    columnNameMap: Record<string, string>
): string {
    const newlineIndex = csvText.indexOf("\n")
    const headerLine = csvText.slice(0, newlineIndex)
    const rest = csvText.slice(newlineIndex + 1)
    const newHeader = headerLine
        .split(",")
        .map((col) => columnNameMap[col] ?? col)
    return [newHeader.join(","), rest].join("\n")
}

async function main() {
    const slug = process.argv[2]
    const title = process.argv[3] ?? slug
    if (!slug) {
        console.error('Usage: buildMdimPackage.mts <slug> "<title>"')
        process.exit(1)
    }

    console.log(`Fetching staged data for ${slug}...`)
    const indicators: IndicatorEntry[] = await fetch(
        `${STAGING_BASE}/${slug}/indicators.json`
    ).then((r) => r.json())
    const csvText = await fetch(`${STAGING_BASE}/${slug}/wide.csv`).then((r) =>
        r.text()
    )
    console.log(
        `Got ${indicators.length} indicators, CSV ${(csvText.length / 1e6).toFixed(1)} MB`
    )

    console.log(
        `Fetching real metadata for ${indicators.length} indicators from the Data API...`
    )
    const rawMetas = await Promise.all(
        indicators.map((ind) => fetchIndicatorMetadata(ind.owidVariableId))
    )

    const columnNameMap: Record<string, string> = {}
    const metadataColumns: Record<string, any> = {}
    const readmeColumnSections: string[] = []
    const seenLongNames = new Map<string, string>()

    for (let i = 0; i < indicators.length; i++) {
        const ind = indicators[i]
        const def = toColumnDef(rawMetas[i])
        const col = toColumnShim(def)

        const longName = computeLongColumnName(def)
        const existing = seenLongNames.get(longName)
        if (existing && existing !== ind.wideColumnName) {
            console.warn(
                `Column name collision: "${longName}" used by both ${existing} and ${ind.wideColumnName}`
            )
        }
        seenLongNames.set(longName, ind.wideColumnName)
        columnNameMap[ind.wideColumnName] = longName

        const attributionFragments = getAttributionFragmentsFromVariable(def)
        const citationShort = getCitationShort(
            def.origins ?? [],
            attributionFragments,
            def.owidProcessingLevel
        )
        const citationLong = getCitationLong(
            col.titlePublicOrDisplayName,
            def.origins ?? [],
            col.source,
            attributionFragments,
            def.presentation?.attributionShort,
            def.presentation?.titleVariant,
            def.owidProcessingLevel,
            undefined,
            undefined
        )

        metadataColumns[longName] = {
            titleShort: col.titlePublicOrDisplayName.title,
            titleLong: longName,
            descriptionShort: def.descriptionShort,
            descriptionKey: def.descriptionKey,
            descriptionProcessing: def.descriptionProcessing,
            unit: def.unit,
            shortUnit: def.shortUnit,
            timespan: def.timespan,
            type: def.type,
            owidVariableId: ind.owidVariableId,
            shortName: def.shortName,
            lastUpdated: getLastUpdatedFromVariable(def),
            nextUpdate: getNextUpdateFromVariable(def),
            citationShort,
            citationLong,
            fullMetadata: `https://api.ourworldindata.org/v1/indicators/${ind.owidVariableId}.metadata.json`,
        }

        readmeColumnSections.push(columnReadmeText(col).join("\n"))
    }

    const newCsv = renameCsvHeader(csvText, columnNameMap)

    const metadataJson = {
        chart: {
            title,
            originalChartUrl: `https://ourworldindata.org/grapher/${slug.replace(/_/g, "-")}`,
        },
        columns: metadataColumns,
        dateDownloaded: new Date().toISOString().slice(0, 10),
        activeFilters: {},
    }

    const readme = `# ${title} — complete dataset

This package contains **all dimension combinations** of the OWID multidimensional
dataset "${title}" — every metric/breakdown choice, not just whichever view was
selected when you clicked download. Downloaded on ${metadataJson.dateDownloaded}.

## Files

- \`${slug}.csv\` — one row per country/year (or country/date), one column per
  indicator × dimension combination, using each indicator's real display name.
- \`${slug}.metadata.json\` — per-column metadata: descriptions, units, and
  citations, sourced from the same Data API as any other OWID chart download.
- This README, with per-column source/citation details below.

${readmeColumnSections.join("\n")}
`

    const zipContent: UncompressedFile[] = [
        {
            path: `${slug}.metadata.json`,
            data: JSON.stringify(metadataJson, undefined, 2),
        },
        { path: `${slug}.csv`, data: newCsv },
        { path: "readme.md", data: readme },
    ]
    const zipBuffer = await createZip(zipContent)
    console.log(`Built zip: ${(zipBuffer.length / 1e6).toFixed(2)} MB`)

    const s3Client = createS3Client({
        endpoint: R2_ENDPOINT,
        region: R2_REGION,
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    })
    const key = `${FINAL_BASE_PATH}/${slug}/${slug}.zip`
    await saveObjectToR2(
        Buffer.from(zipBuffer),
        FINAL_BUCKET,
        key,
        "application/zip",
        undefined,
        s3Client
    )

    const finalUrl = `https://owid-public.owid.io/${key}`
    console.log(`Uploaded: ${finalUrl}`)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
