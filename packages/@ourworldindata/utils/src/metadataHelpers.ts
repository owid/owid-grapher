import {
    OwidOrigin,
    OwidVariableWithSource,
    OwidProcessingLevel,
    DisplaySource,
    IndicatorTitleWithFragments,
    OwidSource,
    PrimaryTopic,
} from "@ourworldindata/types"
import * as _ from "lodash-es"
import { excludeUndefined } from "./Util"
import dayjs from "./dayjs.js"
import {
    formatDateForCitation,
    getPhraseForArchivalDate,
} from "./archival/archivalDate.js"

/**
 * One label per origin: its explicit attribution, or its producer plus
 * publication year, e.g. `["UN WPP (2024)", "HYDE"]`. Renders in a chart's
 * sources line and in the download modal's list of data sources.
 */
export function getOriginAttributionFragments(
    origins: OwidOrigin[] | undefined
): string[] {
    return origins
        ? origins.map((origin) => {
              const yearPublished = origin.datePublished
                  ? dayjs(origin.datePublished, ["YYYY-MM-DD", "YYYY"]).year()
                  : undefined
              const yearPublishedString = yearPublished
                  ? ` (${yearPublished})`
                  : ""
              return (
                  origin.attribution ??
                  `${origin.producer}${yearPublishedString}`
              )
          })
        : []
}

/**
 * Who to credit for an indicator. A hand-set attribution wins; otherwise the
 * source name and the origins, deduplicated. E.g. `["World Bank", "UN WPP
 * (2024)"]`. Feeds the "Source" row of the key-data table and both citations.
 */
export function getAttributionFragmentsFromVariable(
    variable: Pick<
        OwidVariableWithSource,
        "presentation" | "origins" | "source"
    >
): string[] {
    if (
        variable.presentation?.attribution &&
        variable.presentation?.attribution !== ""
    )
        return [variable.presentation?.attribution]

    const originAttributionFragments = getOriginAttributionFragments(
        variable.origins
    )
    const name = variable.source?.name
    return _.uniq(_.compact([name, ...originAttributionFragments]))
}

interface ETLPathComponents {
    channel: string
    producer: string
    version: string
    dataset: string
    table: string
    indicator: string
}

/**
 * Splits an ETL catalog path into its parts. Real paths separate the indicator
 * with "#" rather than "/", so it arrives glued to `table` and `indicator` stays
 * undefined. Used in the admin to link to an indicator's ETL steps on GitHub.
 */
export const getETLPathComponents = (path: string): ETLPathComponents => {
    const [channel, producer, version, dataset, table, indicator] =
        path.split("/")
    return { channel, producer, version, dataset, table, indicator }
}

const isFullDate = (date: string): boolean => {
    const fullDateRegex = /^\d{4}-\d{2}-\d{2}$/
    return !!date.match(fullDateRegex)
}

/**
 * When the data was last refreshed. Takes the catalog path version if that's a
 * full date, otherwise the latest `dateAccessed` of the origins, e.g.
 * `"2024-07-11"`. Renders as the "Last updated" row of the key-data table.
 */
export const getLastUpdatedFromVariable = (
    variable: Pick<OwidVariableWithSource, "catalogPath" | "origins">
): string | undefined => {
    // if possible, extract date from the catalog path
    const version = getETLPathComponents(variable.catalogPath ?? "")?.version
    if (version && isFullDate(version)) return version

    const { origins = [] } = variable
    const originDates = excludeUndefined(
        origins.map((origin) => origin.dateAccessed)
    )

    if (originDates.length === 0) return undefined

    // alternatively, pick the latest dateAccessed from the origins
    const latestDate = new Date(
        Math.max(...originDates.map((date) => new Date(date).getTime()))
    )
    return dayjs(latestDate).format("YYYY-MM-DD")
}

/**
 * The last update plus the update period, e.g. `"2025-07-11"`, or a month from
 * today if that date has already passed. Renders as the "Next expected update"
 * row of the key-data table.
 */
export const getNextUpdateFromVariable = (
    variable: Pick<OwidVariableWithSource, "catalogPath" | "updatePeriodDays">
): string | undefined => {
    const lastUpdated = getLastUpdatedFromVariable(variable)
    let nextUpdate = undefined
    if (variable.updatePeriodDays) {
        const lastUpdatedDate = dayjs(lastUpdated)
        const scheduledUpdate = lastUpdatedDate.add(
            variable.updatePeriodDays,
            "day"
        )
        // If the next update date is in the past, we set it to the next month
        if (scheduledUpdate.isBefore(dayjs()))
            nextUpdate = dayjs().add(1, "month")
        else nextUpdate = scheduledUpdate
    }
    return nextUpdate?.format("YYYY-MM-DD")
}

/** How much we reshaped the data, e.g. `"with minor processing"` */
const getPhraseForProcessingLevel = (
    processingLevel: OwidProcessingLevel | undefined
): string => {
    switch (processingLevel) {
        case "major":
            return "with major processing"
        case "minor":
            return "with minor processing"
        default:
            return "processed"
    }
}

/**
 * Whether we are the only party being credited, in which case saying we also
 * processed the data adds nothing. Takes the fragments either as a list or
 * already joined, since the surfaces that render prose have joined them by the
 * time they ask.
 */
const isOwidTheSoleAttribution = (attribution: string | string[]): boolean => {
    const fragments = Array.isArray(attribution) ? attribution : [attribution]
    return (
        fragments.length === 1 &&
        fragments[0].toLowerCase() === "our world in data"
    )
}

/**
 * The processing phrase to show after an attribution, e.g. `"with minor
 * processing"`, or nothing when we are the only party credited.
 */
export const getProcessingPhraseForAttribution = (
    attribution: string | string[],
    owidProcessingLevel: OwidProcessingLevel | undefined
): string | undefined =>
    isOwidTheSoleAttribution(attribution)
        ? undefined
        : getPhraseForProcessingLevel(owidProcessingLevel)

const prepareOriginForDisplay = (origin: OwidOrigin): DisplaySource => {
    let label = origin.producer ?? ""
    if (origin.title && origin.title !== label) {
        label += " – " + origin.title
    }

    return {
        label,
        description: origin.description,
        retrievedOn: origin.dateAccessed,
        retrievedFrom: origin.urlMain,
        citation: origin.citationFull,
    }
}

/**
 * An indicator's origins, plus its legacy source if that has provenance of its
 * own, as one displayable list. Labels read `"UN WPP – World Population
 * Prospects"`. Renders as the per-source blocks of "Sources and processing".
 */
export const prepareSourcesForDisplay = (
    variable: Pick<OwidVariableWithSource, "origins" | "source">
): DisplaySource[] => {
    const { origins, source } = variable

    const sourcesForDisplay: DisplaySource[] = []

    if (
        source?.name &&
        (source?.dataPublishedBy || source?.retrievedDate || source?.link)
    ) {
        sourcesForDisplay.push({
            label: source?.name,
            dataPublishedBy: source?.dataPublishedBy,
            retrievedOn: source?.retrievedDate,
            retrievedFrom: source?.link,
        })
    }

    if (origins && origins.length > 0) {
        sourcesForDisplay.push(
            ...origins.map((origin) => prepareOriginForDisplay(origin))
        )
    }

    return sourcesForDisplay
}

/**
 * The year to append to a producer's name, from `dateAccessed` or else
 * `datePublished`, e.g. `" (2024)"`. Renders inside the producer labels of the
 * citations.
 */
export const getYearSuffixFromOrigin = (origin: OwidOrigin): string => {
    const year = origin.dateAccessed
        ? dayjs(origin.dateAccessed, ["YYYY-MM-DD", "YYYY"]).year()
        : origin.datePublished
          ? dayjs(origin.datePublished, ["YYYY-MM-DD", "YYYY"]).year()
          : undefined
    if (year) return ` (${year})`
    else return ""
}

/**
 * The abbreviated indicator citation, e.g. `"UN WPP (2024); HYDE (2023) – with
 * minor processing by Our World in Data"`. More than three attributions collapse
 * to "UN WPP (2024) and other sources". `origins` is dead code. Renders as the
 * "In-line citation" under "How to cite this data".
 */
const getCitationShort = ({
    origins,
    attributions,
    owidProcessingLevel,
}: {
    origins: OwidOrigin[]
    attributions: string[]
    owidProcessingLevel?: OwidProcessingLevel
}): string => {
    const producersWithYear = _.uniq(
        origins.map(
            (origin) => `${origin.producer}${getYearSuffixFromOrigin(origin)}`
        )
    )
    const processingLevelPhrase =
        getPhraseForProcessingLevel(owidProcessingLevel)

    const attributionFragments = attributions ?? producersWithYear
    const attributionShortened =
        attributionFragments.length > 3
            ? `${attributionFragments[0]} and other sources`
            : attributionFragments.join("; ")

    return `${attributionShortened} – ${processingLevelPhrase} by Our World in Data`
}

/**
 * The full indicator citation. The attribution unshortened, then the dataset
 * title, the original data and the retrieval date, dropping any part with nothing
 * to say. Renders as the "Full citation" under "How to cite this data".
 */
const getCitationLong = ({
    indicatorTitle,
    origins,
    source,
    attributions,
    attributionShort,
    titleVariant,
    owidProcessingLevel,
    citationUrl,
    archivalDate,
}: {
    indicatorTitle: IndicatorTitleWithFragments
    origins: OwidOrigin[]
    source?: OwidSource
    attributions: string[]
    attributionShort?: string
    titleVariant?: string
    owidProcessingLevel?: OwidProcessingLevel
    citationUrl?: string
    archivalDate?: string
}): string => {
    const titleFragments =
        attributionShort && titleVariant
            ? `${attributionShort} – ${titleVariant}`
            : attributionShort || titleVariant
    const producersWithYear = _.uniq(
        origins.map(
            (origin) => `${origin.producer}${getYearSuffixFromOrigin(origin)}`
        )
    )
    const processingLevelPhrase =
        getPhraseForProcessingLevel(owidProcessingLevel)

    const attributionFragments = attributions ?? producersWithYear
    const attributionUnshortened = attributionFragments.join("; ")
    const attributionWithProcessing = `${attributionUnshortened} – ${processingLevelPhrase} by Our World in Data`
    const titleWithFragments = excludeUndefined([
        indicatorTitle.title,
        titleFragments,
    ]).join(" – ")
    const originCitations = _.uniq(
        origins.map(
            (origin) =>
                `${origin.producer}, “${origin.title ?? origin.titleSnapshot}${
                    origin.versionProducer ? " " + origin.versionProducer : ""
                }”`
        )
    ).join("; ")
    const today = formatDateForCitation(dayjs())
    const archivalPhrase = getPhraseForArchivalDate(archivalDate)
    return excludeUndefined([
        `${attributionWithProcessing}.`,
        `“${titleWithFragments}” [dataset].`,
        originCitations
            ? `${originCitations} [original data].`
            : source?.name
              ? `${source?.name} [original data].`
              : undefined,
        citationUrl
            ? `Retrieved ${today} from ${citationUrl}${archivalPhrase ? ` ${archivalPhrase}` : ""}`
            : undefined,
    ]).join(" ")
}

/**
 * The "How to cite this page" citation, covering the OWID-authored data page as a
 * whole (descriptions, FAQs, etc.) rather than just the data. Credits the topic
 * page it belongs to where there is one, Our World in Data otherwise. Renders
 * below the indicator citations.
 */
const getCitationDatapage = ({
    indicatorTitle,
    origins,
    source,
    primaryTopic,
    citationUrl,
    archivalDate,
}: {
    indicatorTitle: IndicatorTitleWithFragments
    origins: OwidOrigin[]
    source?: OwidSource
    primaryTopic?: PrimaryTopic
    citationUrl: string
    archivalDate?: string
}): string => {
    const currentYear = dayjs().year()
    const producers = _.uniq(origins.map((origin) => `${origin.producer}`))
    const adaptedFrom =
        producers.length > 0 ? producers.join(", ") : source?.name

    // Add a period to the primary topic citation unless it already ends with a
    // period or question mark.
    const maybeAddPeriod = (s: string): string =>
        s.endsWith("?") || s.endsWith(".") ? s : `${s}.`
    const primaryTopicCitation = maybeAddPeriod(primaryTopic?.citation ?? "")
    const archivalPhrase = getPhraseForArchivalDate(archivalDate)
    return excludeUndefined([
        primaryTopic
            ? `“Data Page: ${indicatorTitle.title}”, part of the following publication: ${primaryTopicCitation}`
            : `“Data Page: ${indicatorTitle.title}”. Our World in Data (${currentYear}).`,
        adaptedFrom ? `Data adapted from ${adaptedFrom}.` : undefined,
        `Retrieved from ${citationUrl} [online resource]${
            archivalPhrase ? ` ${archivalPhrase}` : ""
        }`,
    ]).join(" ")
}

/**
 * Every citation an indicator needs, built from one set of values rather than
 * three overlapping argument lists. `datapage` is omitted when no `citationUrl`
 * is given, which is how the callers that want only the indicator citations opt
 * out of it.
 *
 * Renders as the "How to cite this data" section of a data page, and as the same
 * section of Grapher's sources modal, which shows only `short` and `long`.
 */
export const getIndicatorCitations = ({
    indicatorTitle,
    origins,
    source,
    attributions,
    attributionShort,
    titleVariant,
    owidProcessingLevel,
    citationUrl,
    archivalDate,
    primaryTopic,
}: {
    indicatorTitle: IndicatorTitleWithFragments
    origins: OwidOrigin[]
    source?: OwidSource
    attributions: string[]
    attributionShort?: string
    titleVariant?: string
    owidProcessingLevel?: OwidProcessingLevel
    citationUrl?: string
    archivalDate?: string
    primaryTopic?: PrimaryTopic
}): { short: string; long: string; datapage?: string } => ({
    short: getCitationShort({ origins, attributions, owidProcessingLevel }),
    long: getCitationLong({
        indicatorTitle,
        origins,
        source,
        attributions,
        attributionShort,
        titleVariant,
        owidProcessingLevel,
        citationUrl,
        archivalDate,
    }),
    // An empty citationUrl is not the same as none: mdim pages baked without a
    // slug have one (MultiDimBaker.tsx), and cited the page anyway before this
    // was one entry point
    datapage:
        citationUrl !== undefined
            ? getCitationDatapage({
                  indicatorTitle,
                  origins,
                  source,
                  primaryTopic,
                  citationUrl,
                  archivalDate,
              })
            : undefined,
})

/**
 * Reformats an ETL date for display, e.g. `"July 11, 2024"`. Reads ISO and
 * day-first spellings; a date it can't parse passes through untouched. Renders in
 * the "Last updated" and "Retrieved on" rows.
 */
export const formatSourceDate = (
    date: string | undefined,
    format: string
): string | null => {
    const parsedDate = dayjs(date ?? "", ["YYYY-MM-DD", "DD/MM/YYYY"])
    if (!parsedDate.isValid()) return date || null
    return parsedDate.format(format)
}

/**
 * An indicator's timespan as a year range, e.g. `"1990–2020"` or `"5000 BCE –
 * 2020 CE"`. Null for anything that isn't two dash-separated years, since the
 * field is free text. Renders as the "Date range" row of the key-data table.
 */
export const getDateRange = (timespan: string): string | null => {
    // This regex matches:
    //   Beginning of string
    //   Ignore whitespace
    //   a named group called start that matches:
    //     hyphen aka minus
    //     1 or more digits
    //   Ignore whitespace
    //   hyphen aka minus OR en dash
    //   Ignore whitespace
    //   a named group called end that matches:
    //     hyphen aka minus
    //     1 or more digits
    //   Ignore whitespace
    //   End of string
    const timespanRegex = /^\s*(?<start>(-)?\d+)\s*(-|–)\s*(?<end>(-)?\d+)\s*$/
    const match = timespan.match(timespanRegex)
    if (match) {
        const firstYearString = match.groups?.start
        const lastYearString = match.groups?.end
        if (!firstYearString || !lastYearString) return null

        const firstYear = parseInt(firstYearString, 10)
        const lastYear = parseInt(lastYearString, 10)
        let formattedFirstYear

        // if start year is before year 0, add BCE to the end
        if (firstYear < 0) formattedFirstYear = `${Math.abs(firstYear)} BCE`
        else formattedFirstYear = firstYear

        // if end year is before year 0, add BCE to the end or, if start year is after year 0, add CE to the end
        let formattedLastYear
        if (lastYear < 0) formattedLastYear = `${Math.abs(lastYear)} BCE`
        else if (firstYear < 0) formattedLastYear = `${lastYear} CE`
        else formattedLastYear = lastYear

        if (lastYear < 0 || firstYear < 0)
            return `${formattedFirstYear} – ${formattedLastYear}`
        else return `${formattedFirstYear}–${formattedLastYear}`
    }
    return null
}
