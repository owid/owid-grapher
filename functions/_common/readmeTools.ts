import * as _ from "lodash-es"
import {
    formatAttributions,
    formatSourceDate,
    getAttributionFragmentsFromVariable,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    getAttributionWithProcessing,
    OwidColumnDef,
    getDateRange,
    getIndicatorCitations,
    prepareSourcesForDisplay,
    formatDate,
    stripDetailOnDemandLinks,
} from "@ourworldindata/utils"
import type { CoreColumn } from "@ourworldindata/core-table"
import type { DisplaySource } from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import { getGrapherFilters } from "./urlTools.js"

const markdownNewlineEnding = "  "

/**
 * The readme used to print both the short in-line citation and a full one spelling
 * out every origin. The full one repeats producer names that the document's Sources
 * section now gives in far more detail, and on a multi-indicator download it was a
 * fifth of the file, so only the short one is left. Nothing is lost: metadata.json
 * still carries `citationLong` for every column, and each source's own requested
 * citation is in the Sources section verbatim.
 */
export function* getCitationLines(
    def: OwidColumnDef,
    col: CoreColumn
): Generator<string, void, unknown> {
    yield ""
    yield "#### How to cite this data"
    yield ""
    const { short: citationShort } = getIndicatorCitations({
        indicatorTitle: col.titlePublicOrDisplayName,
        origins: def.origins ?? [],
        source: col.source ?? {},
        attributions: getAttributionFragments(col),
        attributionShort: def.presentation?.attributionShort,
        titleVariant: def.presentation?.titleVariant,
        owidProcessingLevel: def.owidProcessingLevel,
    })
    yield citationShort
}

/**
 * The one heading not pushed a level deeper, because it already was: at `####` among
 * `###` siblings it read as a child of whatever came last (the final source block).
 * Now that its siblings are `####` too, it is where it belongs.
 */
export function* getDataProcessingLines(
    def: OwidColumnDef
): Generator<string, void, unknown> {
    if (def.descriptionProcessing) {
        yield ""
        yield `#### Notes on our processing step for this indicator`
        yield def.descriptionProcessing
    }
}

/**
 * The descriptionFromProducer heading used to name the producers. For an indicator
 * combining several it ran to a full line of names and read as a question about a
 * list ("How is this data described by its producer - Ember (2026), Energy Institute
 * (2026), Pinto et al. (2023)?"). The plural heading works for one producer as well
 * as seven.
 */
export function* getDescriptionLines(
    def: OwidColumnDef
): Generator<string, void, unknown> {
    const descriptionKey = def.descriptionKey
    if (descriptionKey) {
        yield ""
        yield `#### What you should know about this data`
        yield descriptionKey.trim()
    }

    if (def.descriptionFromProducer) {
        yield ""
        yield `#### How this data is described by its producers`
        yield def.descriptionFromProducer.trim()
    }

    if (def.additionalInfo) {
        yield ""
        yield `#### Additional information about this data`
        yield def.additionalInfo.trim()
    }
}

export function* getKeyDataLines(
    def: OwidColumnDef,
    col: CoreColumn
): Generator<string, void, unknown> {
    const lastUpdated = getLastUpdatedFromVariable(def)
    if (lastUpdated)
        yield (
            `Last updated: ${formatSourceDate(lastUpdated, "MMMM D, YYYY")}` +
                markdownNewlineEnding
        )

    // "Next expected update", not "Next update": the date is the producer's stated
    // update period added to our last update, so it is our expectation, not a promise.
    const nextUpdate = getNextUpdateFromVariable(def)
    if (nextUpdate)
        yield (
            `Next expected update: ${formatSourceDate(nextUpdate, "MMMM YYYY")}` +
                markdownNewlineEnding
        )

    const dateRange = def.timespan ? getDateRange(def.timespan) : undefined
    if (dateRange) yield `Date range: ${dateRange}` + markdownNewlineEnding

    const unit = def.unit
    if (unit) yield `Unit: ${unit}` + markdownNewlineEnding

    const unitConversionFactor =
        col.unitConversionFactor && col.unitConversionFactor !== 1
            ? col.unitConversionFactor
            : undefined
    if (unitConversionFactor)
        yield (
            `Unit conversion factor: ${unitConversionFactor}` +
                markdownNewlineEnding
        )
}

export function yieldMultilineTextAsLines(line: string): string[] {
    return line.split("\n").map((l) => l.trim())
}

/**
 * Every distinct source across the columns, in first-seen order.
 *
 * Deduplicated on everything that gets rendered rather than on the label alone: the
 * same producer retrieved twice on different dates is two rows a reader may need, and
 * collapsing them would quietly drop a retrieval date.
 */
export function collectUniqueSources(columns: CoreColumn[]): DisplaySource[] {
    const sources = columns.flatMap((col) =>
        prepareSourcesForDisplay(col.def as OwidColumnDef)
    )
    return _.uniqBy(sources, (source) =>
        JSON.stringify([
            source.label,
            source.dataPublishedBy,
            source.retrievedOn,
            source.retrievedFrom,
        ])
    )
}

/**
 * The document's Sources section, listing each source once instead of repeating it
 * inside every indicator's block. Repeating them is bearable for a chart's handful of
 * columns and unreadable for a complete-dataset download: 46 columns drawn from 7
 * sources produced 354 blocks, most of the file.
 *
 * The section sits last, after the indicators: it is reference material a reader
 * arrives at from a citation, not something to read past on the way to the column they
 * opened the file for.
 *
 * Listing them once is also what makes room for the detail someone re-using the data
 * actually needs — what the source is, who published it and when, where to get it
 * (including the direct file, where the origin records one), the terms it comes under,
 * and how to cite it — rather than the retrieval date and URL the per-indicator blocks
 * were limited to.
 */
export function* getSourcesSection(
    columns: CoreColumn[]
): Generator<string, void, undefined> {
    const sources = collectUniqueSources(columns)
    if (sources.length === 0) return

    yield ""
    yield sources.length === 1 ? "## Source" : "## Sources"
    yield ""
    yield "These are the sources behind the data in this package. Each time series above names the ones it draws on in its citation."

    for (const source of sources) {
        yield ""
        yield `### ${source.label}`

        const description = source.description?.trim()
        if (description) {
            yield ""
            yield description
        }

        const facts = _.compact([
            source.producer && `Producer: ${source.producer.trim()}`,
            source.dataPublishedBy &&
                `Data published by: ${source.dataPublishedBy.trim()}`,
            source.datePublished && `Published: ${source.datePublished.trim()}`,
            source.retrievedOn && `Retrieved on: ${source.retrievedOn.trim()}`,
            source.retrievedFrom &&
                `Retrieved from: ${source.retrievedFrom.trim()}`,
            source.urlDownload &&
                `Direct download: ${source.urlDownload.trim()}`,
            source.license?.name &&
                `License: ${source.license.name.trim()}${
                    source.license.url ? ` (${source.license.url.trim()})` : ""
                }`,
        ])
        if (facts.length > 0) {
            yield ""
            for (const fact of facts) yield fact + markdownNewlineEnding
        }

        const citation = source.citation?.trim()
        if (citation) {
            yield ""
            yield `Citation: ${citation}`
        }
    }
}

function getAttributionFragments(col: CoreColumn): string[] {
    const def = col.def as OwidColumnDef
    return getAttributionFragmentsFromVariable({ ...def, source: col.source })
}

export function getAttribution(col: CoreColumn): string {
    return formatAttributions(getAttributionFragments(col))
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

/**
 * One indicator's section. Every heading sits a level deeper than it used to, because
 * these sections are children of the document's "Detailed information ..." heading —
 * at the old levels an indicator was a sibling of the heading introducing it, so the
 * whole second half of the readme was flat.
 */
function* columnReadmeText(col: CoreColumn) {
    const def = col.def as OwidColumnDef

    const title = getTitle(col)
    yield ""
    yield `### ${title}`

    yield* getDescription(def)

    yield* getKeyDataLines(def, col)

    // The attribution is a fact about the indicator like the ones above, so it goes
    // with them. It used to print immediately after the full citation, where it read
    // as a trailing fragment of it; with the full citation gone it would have sat next
    // to the short one looking like a duplicate.
    const source = getAttributionWithProcessing(
        getAttribution(col),
        def.owidProcessingLevel
    )
    yield `Source: ${source}` + markdownNewlineEnding

    yield* getCitationLines(def, col)

    yield* getDescriptionLines(def)

    yield* getDataProcessingLines(def)
    yield ""
}

function* activeFilterSettings(
    searchParams: URLSearchParams,
    multiDimAvailableDimensions?: string[]
) {
    // NOTE: this is filtered by whitelisted grapher query params - if you want other params to be
    //       inlucded here, add them to the whitelist inside getGrapherFilters
    const filterSettings = getGrapherFilters(
        searchParams,
        multiDimAvailableDimensions
    )
    if (filterSettings) {
        yield ""
        yield `### Active Filters`
        yield ""
        yield `A filtered subset of the full data was downloaded. The following filters were applied:`
        for (const [key, val] of Object.entries(filterSettings)) {
            if (key === "country")
                yield `- ${key}: ${val.replaceAll("~", ", ")}` // country filter is separated with tilde
            else yield `- ${key}: ${val}`
        }
        yield ""
    }
}

/**
 * The chart's `readme.md`.
 *
 * The single- and multi-column readmes used to be two separately maintained template
 * strings, which is how they came to disagree: only the multi-column one told readers
 * how we process data. They are one template now, differing where they genuinely
 * differ — whether a download date is stated, and how the data columns and the
 * tolerance columns are described.
 */
export function constructReadme(
    grapherState: GrapherState,
    columns: CoreColumn[],
    searchParams: URLSearchParams,
    multiDimAvailableDimensions?: string[]
): string {
    const isSingleColumn = columns.length === 1
    // Some computed columns have neither a source nor origins - filter these away
    const columnsWithSources = columns.filter(
        (column) => !!column.source.name || !_.isEmpty(column.def.origins)
    )
    const columnSections = columnsWithSources.flatMap((col) => [
        ...columnReadmeText(col),
    ])
    const sourcesSection = [...getSourcesSection(columnsWithSources)].join("\n")
    const urlWithFilters = `${grapherState.canonicalUrl}`

    const downloadDate = formatDate(new Date()) // formats the date as "October 10, 2024"

    const shouldUseFilteredTable = searchParams.get("csvType") === "filtered"
    const table = shouldUseFilteredTable
        ? grapherState.filteredTableForDownload
        : grapherState.tableForDownload
    const hasOriginalTimeColumn = table.columnsAsArray.some(
        (column) => column.def.derivedFrom?.relationship === "originalTime"
    )

    // A single-column download is the one served from the chart page itself, so it can
    // say when it was downloaded; the multi-column one is also built ahead of time.
    const downloadedOn = isSingleColumn
        ? ` It was downloaded on ${downloadDate}.`
        : ""

    const dataColumnBullet = isSingleColumn
        ? `- The final column is the data column — the time series that powers the chart. Downloaded with the "full data" option it corresponds to the time series below; with "only selected data visible in the chart" it is transformed depending on the chart type, so the correspondence may be less direct.`
        : `- Every remaining column is a data column, each one a time series. Downloaded with the "full data" option each corresponds to one time series below; with "only selected data visible in the chart" they are transformed depending on the chart type, so the correspondence may be less direct.`

    const toleranceExplanation = isSingleColumn
        ? `\nThe data file includes an additional column suffixed with (Original Year) or (Original Day). This column appears when we use "tolerance" to display data for time points where exact data is unavailable. For example, if a country does not have data for one or more years, we use tolerance to fill the gaps using the closest available data points. These suffix columns show you which year (or day) the value really came from, allowing you to see when the data was actually measured.`
        : `\nThe data file includes additional columns suffixed with (Original Year) or (Original Day). These appear when we use "tolerance" to display data for time points where exact data is unavailable. For example, if a country does not have data for one or more years, we use tolerance to fill the gaps using the closest available data points. These suffix columns show you which year (or day) the value really came from, allowing you to see when the data was actually measured.`

    const detailHeading = isSingleColumn
        ? "Detailed information about the data"
        : "Detailed information about each time series"

    const readme = `# ${grapherState.effectiveTitle} - Data package

This data package contains the data that powers the chart ["${grapherState.effectiveTitle}"](${urlWithFilters}) on the Our World in Data website.${downloadedOn}
${[...activeFilterSettings(searchParams, multiDimAvailableDimensions)].join("\n")}
## CSV structure

Each row is an observation for an entity (usually a country or region) at a timepoint.

- "Entity" — the name of the entity, e.g. "United States".
- "Code" — our internal entity code. For most countries this is the [ISO alpha-3](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3) code, e.g. "USA"; historical and other non-standard entities get a custom code.
- "Year" or "Day" — the timepoint. Annual data has a "Year" column holding an integer year; otherwise a "Day" column holds a date string in the form "YYYY-MM-DD".
${dataColumnBullet}
${hasOriginalTimeColumn ? toleranceExplanation : ""}

## Metadata.json structure

The .metadata.json file contains metadata about the data package. The "charts" key contains information to recreate the chart, like the title, subtitle etc.. The "columns" key contains information about each of the columns in the csv, like the unit, timespan covered, citation for the data etc..

## How we process data at Our World in Data

Our World in Data is almost never the original producer of the data - almost all of the data we use has been compiled by others. If you want to re-use data, it is your responsibility to ensure that you adhere to the sources' license and to credit them correctly. Please note that a single time series may have more than one source - e.g. when we stich together data from different time periods by different producers or when we calculate per capita metrics using population data from a second source.

All data and visualizations on Our World in Data rely on data sourced from one or several original data providers. Preparing this original data involves several processing steps. Depending on the data, this can include standardizing country names and world region definitions, converting units, calculating derived indicators such as per capita measures, as well as adding or adapting metadata such as the name or the description given to an indicator.
[Read about our data pipeline](https://docs.owid.io/projects/etl/)

## ${detailHeading}

${columnSections.join("\n")}
${sourcesSection}

    `
    // Detail-on-demand links (e.g. [terawatt-hours](#dod:watt-hours)) render as
    // hover tooltips on the website, but the readme ships inside a downloaded
    // zip where they're just dead links. Strip them here, over the fully
    // assembled document, so any field that starts carrying DoD links later
    // is covered automatically.
    return stripDetailOnDemandLinks(readme)
}
