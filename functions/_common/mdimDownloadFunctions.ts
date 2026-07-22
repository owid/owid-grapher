/**
 * PROTOTYPE (mdim-downloads project). Dynamic "complete dataset" zip for
 * MDIMs, on the same footing as a regular chart's own `.zip` route
 * (fetchZipForGrapher in downloadFunctions.ts): built fresh per request,
 * not a pre-baked artifact sitting at a fixed URL.
 *
 * ETL does the one thing that genuinely benefits from build-time work --
 * joining every view's indicator into one wide table, so this function
 * never has to fetch per-view data on each request -- and stages the
 * result (wide.csv + an indicator index) to R2. This function picks that
 * up, fetches each distinct indicator's real metadata from the Data API
 * (cheap: one call per indicator, deduped, not per view), and reuses
 * grapher's own citation/readme-formatting functions to build the zip,
 * returning it directly -- no intermediate artifact, no separate build
 * step to trigger.
 *
 * See mdim-downloads/solution-space/etl-feasibility.md (owid-projects repo)
 * for why the join lives in ETL while formatting lives here.
 */
import { csvParse, csvFormat } from "d3-dsv"
import { createZip, UncompressedFile } from "littlezipper"
import {
    getCitationShort,
    getCitationLong,
    getAttributionFragmentsFromVariable,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
} from "@ourworldindata/utils"
import { getVariableMetadataRoute } from "@ourworldindata/grapher"
import { MultiDimDataPageConfigEnriched } from "@ourworldindata/types"
import { StatusError } from "itty-router"
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
} from "./readmeTools.js"
import {
    fetchUnparsedGrapherConfig,
    getDataApiUrl,
    GrapherIdentifier,
} from "./grapherTools.js"
import { Env } from "./env.js"

interface IndicatorEntry {
    wideColumnName: string
    catalogPath: string
    owidVariableId: number
}

interface StagedIndex {
    title: string
    titleVariant?: string
    defaultSelection?: string[]
    indicators: IndicatorEntry[]
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

// Mirrors variableTypeToColumnType in LegacyToOwidTable.ts (not exported) so
// the metadata.json "type" field matches the single-chart download's values
// ("Numeric", not the raw API's "float").
function variableTypeToColumnType(type: string): string {
    switch (type) {
        case "ordinal":
            return "Ordinal"
        case "string":
            return "String"
        case "int":
            return "Integer"
        case "float":
            return "Numeric"
        default:
            return "NumberOrString"
    }
}

// Mirrors the titleLong construction in metadataTools.ts's assembleMetadata
// (plain " - " before the modifier, en-dash inside it).
function computeTitleLong(col: any): string {
    const { title, attributionShort, titleVariant } =
        col.titlePublicOrDisplayName
    const attributionString =
        attributionShort && titleVariant
            ? `${attributionShort} – ${titleVariant}`
            : attributionShort || titleVariant
    return attributionString ? `${title} - ${attributionString}` : title
}

// Rebuild the CSV in the single-chart download's shape: Entity, Code,
// Year/Day, then one column per indicator using its long display name.
// Entity codes come from the indicator metadata's own entity dimension --
// the same mapping the regular download uses, no extra data source.
function toDownloadCsv(
    csvText: string,
    columnNameMap: Record<string, string>,
    entityNameToCode: Map<string, string | null>
): string {
    const rows = csvParse(csvText)
    const cols = rows.columns
    const timeCol = cols.find((c) => c === "year" || c === "date")
    if (!timeCol) throw new Error("No year/date column in staged CSV")
    const timeHeader = timeCol === "date" ? "Day" : "Year"
    const dataCols = cols.filter((c) => c !== "country" && c !== timeCol)

    const out = rows.map((row) => {
        const rec: Record<string, any> = {
            Entity: row.country,
            Code: entityNameToCode.get(row.country ?? "") ?? "",
            [timeHeader]: row[timeCol],
        }
        // Round-trip numeric values through Number so integers print without
        // pandas' trailing ".0" ("11", not "11.0") -- matches how grapher's
        // own CSV writer serializes them.
        for (const c of dataCols) {
            const v = row[c]
            rec[columnNameMap[c] ?? c] = v && !isNaN(+v) ? String(+v) : v
        }
        return rec
    })
    return csvFormat(out, [
        "Entity",
        "Code",
        timeHeader,
        ...dataCols.map((c) => columnNameMap[c] ?? c),
    ])
}

export async function fetchCompleteDatasetZipForGrapher(
    identifier: GrapherIdentifier,
    env: Env
): Promise<Response> {
    try {
        return await fetchCompleteDatasetZipForGrapherInner(identifier, env)
    } catch (e) {
        if (e instanceof StatusError) throw e
        // TEMPORARY debug surface -- itty-router's own catch-all swallows
        // non-StatusError details, so this is the only way to see a real
        // stack trace out of a deployed preview. Remove once this route is
        // verified working.
        return new Response(
            JSON.stringify({
                debugError: String(e),
                stack: e instanceof Error ? e.stack : undefined,
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        )
    }
}

async function fetchCompleteDatasetZipForGrapherInner(
    identifier: GrapherIdentifier,
    env: Env
): Promise<Response> {
    // Complete-dataset packages only exist for MDIMs -- charts already have
    // their own `.zip` route (fetchZipForGrapher) and don't need this one.
    const multiDimId: GrapherIdentifier = {
        type: "multi-dim-slug",
        id: identifier.id,
    }
    const configResponse = await fetchUnparsedGrapherConfig(
        multiDimId,
        env,
        undefined
    )
    if (configResponse.status !== 200) throw new StatusError(404)
    const multiDimConfig =
        (await configResponse.json()) as MultiDimDataPageConfigEnriched
    const pkg = multiDimConfig.downloadPackage
    if (!pkg?.csvUrl || !pkg.indicatorsUrl) throw new StatusError(404)

    const [csvText, index] = await Promise.all([
        fetch(pkg.csvUrl).then((r) => r.text()),
        fetch(pkg.indicatorsUrl).then((r): Promise<StagedIndex> => r.json()),
    ])
    const { title, indicators } = index

    const dataApiUrl = getDataApiUrl(env)
    const rawMetas = await Promise.all(
        indicators.map(async (ind) => {
            const res = await fetch(
                getVariableMetadataRoute(dataApiUrl, ind.owidVariableId)
            )
            if (!res.ok)
                throw new StatusError(
                    500,
                    `Failed to fetch metadata for indicator ${ind.owidVariableId}: ${res.status}`
                )
            return res.json()
        })
    )

    const entityNameToCode = new Map<string, string | null>()
    for (const meta of rawMetas as any[]) {
        for (const ent of meta.dimensions?.entities?.values ?? []) {
            if (!entityNameToCode.has(ent.name))
                entityNameToCode.set(ent.name, ent.code)
        }
    }

    const columnNameMap: Record<string, string> = {}
    const metadataColumns: Record<string, any> = {}
    const readmeColumnSections: string[] = []
    const attributions = new Set<string>()
    const seenLongNames = new Map<string, string>()

    for (let i = 0; i < indicators.length; i++) {
        const ind = indicators[i]
        const def = toColumnDef(rawMetas[i])
        const col = toColumnShim(def)

        const longName = computeLongColumnName(def)
        seenLongNames.set(longName, ind.wideColumnName)
        columnNameMap[ind.wideColumnName] = longName

        attributions.add(getAttribution(def))

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
            titleLong: computeTitleLong(col),
            descriptionShort: def.descriptionShort,
            descriptionKey: def.descriptionKey,
            descriptionProcessing: def.descriptionProcessing,
            unit: def.unit,
            shortUnit: def.shortUnit,
            timespan: def.timespan,
            type: variableTypeToColumnType(def.type),
            owidVariableId: ind.owidVariableId,
            shortName: def.shortName,
            lastUpdated: getLastUpdatedFromVariable(def),
            nextUpdate: getNextUpdateFromVariable(def),
            citationShort,
            citationLong,
            fullMetadata: getVariableMetadataRoute(
                dataApiUrl,
                ind.owidVariableId
            ),
        }

        readmeColumnSections.push(columnReadmeText(col).join("\n"))
    }

    const newCsv = toDownloadCsv(csvText, columnNameMap, entityNameToCode)
    const pageUrl = `https://ourworldindata.org/grapher/${identifier.id}`

    const metadataJson = {
        chart: {
            title,
            citation: [...attributions].sort().join("; "),
            originalChartUrl: pageUrl,
            selection: index.defaultSelection ?? [],
        },
        columns: metadataColumns,
        dateDownloaded: new Date().toISOString().slice(0, 10),
        activeFilters: {},
    }

    // Same skeleton as constructReadme()'s multi-column branch in
    // readmeTools.ts (that function needs a live GrapherState, so it can't be
    // called directly) -- one sentence added to say the package covers every
    // dimension combination, no tolerance columns in this data.
    const readme = `# ${title} - Data package

This data package contains the data that powers the chart ["${title}"](${pageUrl}) on the Our World in Data website. It includes every dimension combination of this multidimensional dataset -- all metric/breakdown choices, not just the view selected on the chart.

## CSV Structure

The high level structure of the CSV file is that each row is an observation for an entity (usually a country or region) and a timepoint (usually a year).

The first two columns in the CSV file are "Entity" and "Code". "Entity" is the name of the entity (e.g. "United States"). "Code" is the OWID internal entity code that we use if the entity is a country or region. For most countries, this is the same as the [iso alpha-3](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3) code of the entity (e.g. "USA") - for non-standard countries like historical countries these are custom codes.

The third column is either "Year" or "Day". If the data is annual, this is "Year" and contains only the year as an integer. If the column is "Day", the column contains a date string in the form "YYYY-MM-DD".

The remaining columns are the data columns, each of which is a time series corresponding to one dimension combination of this dataset.

## Metadata.json structure

The .metadata.json file contains metadata about the data package. The "chart" key contains information to recreate the chart, like the title, subtitle etc.. The "columns" key contains information about each of the columns in the csv, like the unit, timespan covered, citation for the data etc..

## About the data

Our World in Data is almost never the original producer of the data - almost all of the data we use has been compiled by others. If you want to re-use data, it is your responsibility to ensure that you adhere to the sources' license and to credit them correctly. Please note that a single time series may have more than one source - e.g. when we stich together data from different time periods by different producers or when we calculate per capita metrics using population data from a second source.

### How we process data at Our World In Data
All data and visualizations on Our World in Data rely on data sourced from one or several original data providers. Preparing this original data involves several processing steps. Depending on the data, this can include standardizing country names and world region definitions, converting units, calculating derived indicators such as per capita measures, as well as adding or adapting metadata such as the name or the description given to an indicator.
[Read about our data pipeline](https://docs.owid.io/projects/etl/)

## Detailed information about each time series

${readmeColumnSections.join("\n")}
`

    const zipContent: UncompressedFile[] = [
        {
            path: `${identifier.id}.metadata.json`,
            data: JSON.stringify(metadataJson, undefined, 2),
        },
        { path: `${identifier.id}.csv`, data: newCsv },
        { path: "readme.md", data: readme },
    ]
    const content = await createZip(zipContent)

    return new Response(content, {
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${identifier.id}.zip"`,
        },
    })
}
