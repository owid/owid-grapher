import {
    OwidOrigin,
    OwidVariableWithSource,
    OwidProcessingLevel,
    DisplaySource,
    IndicatorTitleWithFragments,
    OwidSource,
    PrimaryTopic,
    type BespokeMetadata,
} from "@ourworldindata/types"
import * as _ from "lodash-es"
import { excludeUndefined } from "./Util"
import dayjs from "./dayjs.js"
import {
    formatDateForCitation,
    getPhraseForArchivalDate,
} from "./archival/archivalDate.js"

export interface OriginAttribution {
    label: string
    url?: string
}

const getOriginAttributionLabel = (origin: OwidOrigin): string | undefined => {
    if (origin.attribution) return origin.attribution

    const name = origin.producer ?? origin.title ?? origin.urlMain
    if (!name) return undefined

    const yearPublished = origin.datePublished
        ? dayjs(origin.datePublished, ["YYYY-MM-DD", "YYYY"]).year()
        : undefined

    return yearPublished ? `${name} (${yearPublished})` : name
}

export function getOriginAttributions(
    origins: OwidOrigin[] | undefined
): OriginAttribution[] {
    if (!origins) return []

    return excludeUndefined(
        origins.map((origin) => {
            const label = getOriginAttributionLabel(origin)
            return label ? { label, url: origin.urlMain } : undefined
        })
    )
}

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

    const originAttributions = excludeUndefined(
        (variable.origins ?? []).map(getOriginAttributionLabel)
    )
    const name = variable.source?.name
    return _.uniq(_.compact([name, ...originAttributions]))
}

export function getAttributionFragmentsFromBespokeMetadata(
    metadata: Pick<BespokeMetadata, "attribution" | "origins">
): string[] {
    return getAttributionFragmentsFromVariable({
        presentation: { attribution: metadata.attribution },
        origins: metadata.origins,
    })
}

export const formatAttributions = (attributions: string[]): string =>
    attributions.join("; ")

export const formatAttributionsShortened = (attributions: string[]): string =>
    attributions.length > 3
        ? `${attributions[0]} and other sources`
        : formatAttributions(attributions)

interface ETLPathComponents {
    channel: string
    producer: string
    version: string
    dataset: string
    table: string
    indicator: string
}

export const getETLPathComponents = (path: string): ETLPathComponents => {
    const [channel, producer, version, dataset, table, indicator] =
        path.split(/[/#]/)
    return { channel, producer, version, dataset, table, indicator }
}

const isFullDate = (date: string): boolean => {
    const fullDateRegex = /^\d{4}-\d{2}-\d{2}$/
    return !!date.match(fullDateRegex)
}

export const getLastUpdatedFromVariable = (
    variable: Pick<OwidVariableWithSource, "catalogPath" | "origins">
): string | undefined => {
    // if possible, extract date from the catalog path
    const version = getETLPathComponents(variable.catalogPath ?? "")?.version
    if (version && isFullDate(version)) return version

    const { origins = [] } = variable
    const isoDatesAccessed = excludeUndefined(
        origins.map((origin) => origin.dateAccessed)
    )

    return _.max(isoDatesAccessed)
}

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

const OWID_ATTRIBUTION = "Our World in Data"

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

const isOwidTheSoleAttribution = (attribution: string | string[]): boolean => {
    const fragments = Array.isArray(attribution) ? attribution : [attribution]
    return (
        fragments.length === 1 &&
        fragments[0].toLowerCase() === OWID_ATTRIBUTION.toLowerCase()
    )
}

export const getProcessingPhraseForAttribution = (
    attribution: string | string[],
    owidProcessingLevel: OwidProcessingLevel | undefined
): string | undefined =>
    isOwidTheSoleAttribution(attribution)
        ? undefined
        : getPhraseForProcessingLevel(owidProcessingLevel)

const prepareOriginForDisplay = (origin: OwidOrigin): DisplaySource => {
    const title = origin.title !== origin.producer ? origin.title : undefined
    const label = excludeUndefined([origin.producer, title]).join(" – ")

    return {
        label,
        description: origin.description,
        retrievedOn: origin.dateAccessed,
        retrievedFrom: origin.urlMain,
        citation: origin.citationFull,
        // Read only by the data-download readme, which lists each source once and
        // has room to say more about it than the Sources UIs do.
        producer: origin.producer,
        datePublished: origin.datePublished,
        urlDownload: origin.urlDownload,
        license: origin.license,
    }
}

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

export const getAttributionWithProcessing = (
    attribution: string,
    owidProcessingLevel: OwidProcessingLevel | undefined
): string => {
    const processingPhrase = getProcessingPhraseForAttribution(
        attribution,
        owidProcessingLevel
    )

    return processingPhrase
        ? `${attribution} – ${processingPhrase} by ${OWID_ATTRIBUTION}`
        : attribution
}

const getCitationShort = ({
    attributions,
    owidProcessingLevel,
}: {
    attributions: string[]
    owidProcessingLevel?: OwidProcessingLevel
}): string => {
    return getAttributionWithProcessing(
        formatAttributionsShortened(attributions),
        owidProcessingLevel
    )
}

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
    const citationTitleFragments =
        attributionShort && titleVariant
            ? `${attributionShort} – ${titleVariant}`
            : attributionShort || titleVariant
    const attributionWithProcessing = getAttributionWithProcessing(
        formatAttributions(attributions),
        owidProcessingLevel
    )
    const titleWithFragments = excludeUndefined([
        indicatorTitle.title,
        citationTitleFragments,
    ]).join(" – ")
    const originCitations = _.uniq(
        origins.map((origin) => {
            const title = origin.title ?? origin.titleSnapshot
            const versionProducer = origin.versionProducer
                ? " " + origin.versionProducer
                : ""
            return excludeUndefined([
                origin.producer,
                title ? `“${title}${versionProducer}”` : undefined,
            ]).join(", ")
        })
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
    short: getCitationShort({ attributions, owidProcessingLevel }),
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
    datapage: citationUrl
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

export const formatSourceDate = (
    date: string | undefined,
    format: string
): string | null => {
    const parsedDate = dayjs(date ?? "", ["YYYY-MM-DD", "DD/MM/YYYY"])
    if (!parsedDate.isValid()) return date || null
    return parsedDate.format(format)
}

/**
 * The first and last year of a timespan like "1990-2020" (a hyphen or an en
 * dash, BCE years negative), or of a single year like "2023". Null if it is
 * neither.
 */
const parseTimespan = (
    timespan: string
): { firstYear: number; lastYear: number } | null => {
    const match = timespan.match(
        /^\s*(?<first>-?\d+)\s*(?:(?:-|–)\s*(?<last>-?\d+)\s*)?$/
    )
    const first = match?.groups?.first
    if (!first) return null
    const last = match?.groups?.last ?? first
    return { firstYear: parseInt(first, 10), lastYear: parseInt(last, 10) }
}

/** Whether a timespan covers a single year, e.g. "2023-2023" or "2023" */
export const isSingleYearTimespan = (timespan: string): boolean => {
    const years = parseTimespan(timespan)
    return !!years && years.firstYear === years.lastYear
}

/** A year with "BCE" before year 0, and optionally "CE" after it */
const formatYear = (year: number, withEra = false): string =>
    year < 0 ? `${Math.abs(year)} BCE` : withEra ? `${year} CE` : `${year}`

export const getDateRange = (timespan: string): string | null => {
    const years = parseTimespan(timespan)
    if (!years) return null
    const { firstYear, lastYear } = years

    // data for a single year reads as that year, not "2023–2023"
    if (firstYear === lastYear) return formatYear(firstYear)

    // a range that starts BCE marks its end CE, and is spaced to read clearly
    const spansEras = firstYear < 0 || lastYear < 0
    const formattedRange = [
        formatYear(firstYear),
        formatYear(lastYear, firstYear < 0),
    ]
    return formattedRange.join(spansEras ? " – " : "–")
}
