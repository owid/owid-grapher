import {
    Bounds,
    deserializeJSONFromHTML,
    excludeUndefined,
    formatSourceDate,
    getAttributionFragmentsFromVariable,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    getPhraseForProcessingLevel,
    OwidColumnDef,
    OwidTableSlugs,
    getDateRange,
    uniq,
    getCitationShort,
    getCitationLong,
    prepareSourcesForDisplay,
    uniqBy,
} from "@ourworldindata/utils"
import { CoreColumn } from "@ourworldindata/core-table"
import { Grapher } from "@ourworldindata/grapher"

const markdownNewlineEnding = "  "

export function* getCitationLines(
    def: OwidColumnDef,
    col: CoreColumn
): Generator<string, void, unknown> {
    yield "### How to cite this data"
    yield "#### In-line citation"
    yield `If you have limited space (e.g. in data visualizations), you can use this abbreviated in-line citation:` +
        markdownNewlineEnding
    const citationShort = getCitationShort(
        def.origins ?? [],
        getAttributionFragmentsFromVariable(def),
        def.owidProcessingLevel
    )
    yield citationShort

    yield "#### Full citation"
    const citationLong = getCitationLong(
        col.titlePublicOrDisplayName,
        def.origins ?? [],
        col.source ?? {},
        getAttributionFragmentsFromVariable(def),
        def.presentation?.attributionShort,
        def.presentation?.titleVariant,
        def.owidProcessingLevel,
        undefined
    )
    yield citationLong
}

export function* getDataProcessingLines(
    def: OwidColumnDef
): Generator<string, void, unknown> {
    yield "### How we process data at Our World In Data"
    yield `All data and visualizations on Our World in Data rely on data sourced from one or several original data providers. Preparing this original data involves several processing steps. Depending on the data, this can include standardizing country names and world region definitions, converting units, calculating derived indicators such as per capita measures, as well as adding or adapting metadata such as the name or the description given to an indicator.`
    yield `At the link below you can find a detailed description of the structure of our data pipeline, including links to all the code used to prepare data across Our World in Data.`
    yield `[Read about our data pipeline](https://docs.owid.io/projects/etl/)`
    if (def.descriptionProcessing)
        yield `#### Notes on our processing step for this indicator
${def.descriptionProcessing}`
}

export function* getDescriptionLines(
    def: OwidColumnDef,
    attribution: string
): Generator<string, void, unknown> {
    const descriptionKey = def.descriptionKey
    if (descriptionKey)
        yield `### What you should know about this data
${descriptionKey.map((desc) => `* ${desc.trim()}`).join("\n")}`

    if (def.descriptionFromProducer) {
        yield `### How is this data described by its producer - ${attribution}?`
        yield def.descriptionFromProducer.trim()
    }

    if (def.additionalInfo) {
        yield `### Additional information about this data`
        yield def.additionalInfo.trim()
    }
}

export function* getKeyDataLines(
    def: OwidColumnDef,
    col: CoreColumn
): Generator<string, void, unknown> {
    const lastUpdated = getLastUpdatedFromVariable(def)
    if (lastUpdated)
        yield `Last updated: ${formatSourceDate(lastUpdated, "MMMM D, YYYY")}` +
            markdownNewlineEnding

    const nextUpdate = getNextUpdateFromVariable(def)
    if (nextUpdate)
        yield `Next update: ${formatSourceDate(nextUpdate, "MMMM YYYY")}` +
            markdownNewlineEnding

    const dateRange = def.timespan ? getDateRange(def.timespan) : undefined
    if (dateRange) yield `Date range: ${dateRange}` + markdownNewlineEnding

    const unit = def.unit
    if (unit) yield `Unit: ${unit}` + markdownNewlineEnding

    const unitConversionFactor =
        col.unitConversionFactor && col.unitConversionFactor !== 1
            ? col.unitConversionFactor
            : undefined
    if (unitConversionFactor)
        yield `Unit conversion factor: ${unitConversionFactor}` +
            markdownNewlineEnding
}

export function yieldMultilineTextAsLines(line: string): string[] {
    return line.split("\n").map((l) => l.trim())
}

export function* getSources(
    def: OwidColumnDef
): Generator<string, void, undefined> {
    const sourcesForDisplay = uniqBy(prepareSourcesForDisplay(def), "label")

    if (sourcesForDisplay.length === 0) return
    else if (sourcesForDisplay.length === 1) yield "### Source"
    else yield "### Sources"

    for (const source of sourcesForDisplay) {
        yield `#### ${source.label}`
        if (source.dataPublishedBy)
            yield `Data published by: ${source.dataPublishedBy.trim()}` +
                markdownNewlineEnding
        if (source.retrievedOn)
            yield `Retrieved on: ${source.retrievedOn.trim()}` +
                markdownNewlineEnding
        if (source.retrievedFrom)
            yield `Retrieved from: ${source.retrievedFrom.trim()}` +
                markdownNewlineEnding
        if (source.description) {
            yield "##### Description of the dataset"
            yield* yieldMultilineTextAsLines(source.description).map(
                (l) => `> ${l}`
            )
        }
        if (source.citation) {
            yield "##### Citation"
            yield "This is the citation of the original data obtained from the source, prior to any processing or adaptation by Our World in Data. We would usually prefer to use the Our World In Data citation format given at the bottom." +
                markdownNewlineEnding
            yield* yieldMultilineTextAsLines(source.citation).map(
                (l) => `> ${l}`
            )
        }
    }
}

export function getSource(attribution: string, def: OwidColumnDef): string {
    const processingLevelPhrase =
        attribution.toLowerCase() !== "our world in data"
            ? getPhraseForProcessingLevel(def.owidProcessingLevel)
            : undefined
    const fullProcessingPhrase = processingLevelPhrase
        ? ` – ${processingLevelPhrase} by Our World In Data`
        : ""
    const source = `${attribution}${fullProcessingPhrase}`
    return source
}

export function getAttribution(def: OwidColumnDef): string {
    const producers = uniq(
        excludeUndefined((def.origins ?? []).map((o) => o.producer))
    )

    const attributionFragments =
        getAttributionFragmentsFromVariable(def) ?? producers
    const attribution = attributionFragments.join(", ")
    return attribution
}

export function* getDescription(
    def: OwidColumnDef
): Generator<string, void, undefined> {
    const description = def.descriptionShort || def.description
    if (description) yield* yieldMultilineTextAsLines(description)
}

export function getTitle(col: CoreColumn): string {
    let title = col.titlePublicOrDisplayName.title
    if (
        col.titlePublicOrDisplayName.attributionShort &&
        col.titlePublicOrDisplayName.titleVariant
    )
        title = `${title} – ${col.titlePublicOrDisplayName.titleVariant} – ${col.titlePublicOrDisplayName.attributionShort}`
    else if (col.titlePublicOrDisplayName.titleVariant)
        title = `${title} – ${col.titlePublicOrDisplayName.titleVariant}`
    else if (col.titlePublicOrDisplayName.attributionShort)
        title = `${title} – ${col.titlePublicOrDisplayName.attributionShort}`
    return title
}

function* columnReadmeText(col: CoreColumn) {
    const def = col.def as OwidColumnDef

    const title = getTitle(col)
    yield `## ${title}`

    yield* getDescription(def)

    yield* getKeyDataLines(def, col)

    yield ""

    const attribution = getAttribution(def)

    const source = getSource(attribution, def)
    yield `Source: ${source}`

    yield* getDescriptionLines(def, attribution)

    yield* getSources(def)

    yield* getDataProcessingLines(def)

    yield* getCitationLines(def, col)
    yield ""
}

export function constructReadme(
    grapher: Grapher,
    columns: CoreColumn[]
): string {
    const isSingleColumn = columns.length === 1
    const sources = columns.flatMap((col) => [...columnReadmeText(col)])
    const sourcesAreShort = sources.length < 50
    let readme: string
    if (isSingleColumn)
        readme = `# ${grapher.title} - Data package

This data package contains the data that powers the chart ["${grapher.title}"](${grapher.originUrl}) on the Our World in Data website.

The high level structure of the CSV file is that each row is an observation for an entity (usually a country or region) and a timepoint (usually a year).

The first two columns in the CSV file are "Entity" and "Code". "Entity" is the name of the entity (e.g. "United States"). "Code" is the OWID internal entity code that we use if the entity is a country or region. For normal countries, this is the same as the [iso alpha-3](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3) code of the entity (e.g. "USA") - for non-standard countries like historical countries these are custom codes.

The third column is either "Year" or "Day". If the data is annual, this is "Year" and contains only the year as an integer. If the column is "Day", the column contains a date string in the form "YYYY-MM-DD".

Our World in Data is almost never the original producer of the data - almost all of the data we use has been compiled by others. If you want to re-use data, make sure to check the licenses of the original producers. Follow the information below to do this. Please also note that a single time series may have more than one source - e.g. when we stich together data from different time periods by different producers or when we calculate per capita metrics (which adds a population data source).

## Detailed information about the data

${sources.join("\n")}

    `
    else
        readme = `# ${grapher.title} - Data package

This data package contains the data that powers the chart ["${grapher.title}"](${grapher.originUrl}) on the Our World in Data website.

The high level structure of the CSV file is that each row is an observation for an entity (usually a country or region) and a timepoint (usually a year).

The first two columns in the CSV file are "Entity" and "Code". "Entity" is the name of the entity (e.g. "United States"). "Code" is the OWID internal entity code that we use if the entity is a country or region. For normal countries, this is the same as the [iso alpha-3](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3) code of the entity (e.g. "USA") - for non-standard countries like historical countries these are custom codes.

The third column is either "Year" or "Day". If the data is annual, this is and contains only the year as an integer. If the column is day, the column contains a date string in the form "YYYY-MM-DD".

The remaining columns are the data columns, each of which is a time series. If the CSV data is downloaded using the "full data" option, then each column corresponds to one time series below. If the CSV data is downloaded using the "only selected data visible in the chart" option then the data columns are transformed depending on the chart type and thus the association with the time series might not be as straightforward.

Our World in Data is almost never the original producer of the data - almost all of the data we use has been compiled by others. If you want to re-use data, make sure to check the licenses of the original producers. Follow the information below to do this. Please also note that a single time series may have more than one source - e.g. when we stich together data from different time periods by different producers or when we calculate per capita metrics (which adds a population data source).


## Detailed information about each time series

${sources.join("\n")}

    `
    return readme
}
