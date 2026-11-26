import {
    OwidOrigin,
    OwidVariableWithSource,
    OwidProcessingLevel,
    DisplaySource,
    SourceLinksByIndicator,
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
        case undefined:
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

/**
 * A key for what identifies an origin as a data source to a reader: two
 * origins with the same key are the same source, even if they link to
 * different pages of it. Fields the data page doesn't show are left out, so
 * one source split across ETL snapshots still counts once.
 */
export const getOriginIdentityKey = (origin: OwidOrigin): string =>
    JSON.stringify([
        origin.producer,
        origin.title,
        origin.versionProducer,
        origin.attribution,
        origin.description,
        origin.dateAccessed,
    ])

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
    variable: Pick<OwidVariableWithSource, "origins" | "source">,
    sourceLinksByIndicator: SourceLinksByIndicator[] = []
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
            ...origins.map((origin, originIndex) => {
                const source = prepareOriginForDisplay(origin)
                const indicatorLinks = sourceLinksByIndicator.find(
                    (source) => source.originIndex === originIndex
                )?.links
                return indicatorLinks ? { ...source, indicatorLinks } : source
            })
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
    includeDatasetTitle,
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
    includeDatasetTitle: boolean
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
        includeDatasetTitle ? `“${titleWithFragments}” [dataset].` : undefined,
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
 * The producers of several indicators' origins, each named once. An origin
 * can name several producers at once ("A; B"), which would otherwise repeat
 * the ones another indicator's origin names singly.
 */
const getDistinctProducers = (origins: OwidOrigin[]): string[] =>
    _.uniq(
        origins.flatMap((origin) =>
            (origin.producer ?? "")
                .split(";")
                .map((producer) => producer.trim())
                .filter(Boolean)
        )
    )

const getCitationDatapage = ({
    title,
    producers,
    source,
    primaryTopic,
    citationUrl,
    archivalDate,
}: {
    title: string
    producers: string[]
    source?: OwidSource
    primaryTopic?: PrimaryTopic
    citationUrl: string
    archivalDate?: string
}): string => {
    const currentYear = dayjs().year()
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
            ? `“Data Page: ${title}”, part of the following publication: ${primaryTopicCitation}`
            : `“Data Page: ${title}”. Our World in Data (${currentYear}).`,
        adaptedFrom ? `Data adapted from ${adaptedFrom}.` : undefined,
        `Retrieved from ${citationUrl} [online resource]${
            archivalPhrase ? ` ${archivalPhrase}` : ""
        }`,
    ]).join(" ")
}

/**
 * How a data page with several indicators is cited: by the chart's title, as
 * no one indicator's title describes the page, and so without the long
 * citation's line naming a single indicator's dataset.
 */
export interface PageCitation {
    title: string
    /** On a page with a pane per indicator: the origins of all of them */
    origins?: OwidOrigin[]
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
    pageCitation,
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
    pageCitation?: PageCitation
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
        includeDatasetTitle: !pageCitation,
    }),
    datapage: citationUrl
        ? getCitationDatapage({
              title: pageCitation?.title ?? indicatorTitle.title,
              producers: pageCitation?.origins
                  ? getDistinctProducers(pageCitation.origins)
                  : _.uniq(origins.map((origin) => `${origin.producer}`)),
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

/** The years of "1990-2020" or "2023" (BCE years negative), else null */
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

const isSingleYearTimespan = (timespan: string): boolean => {
    const years = parseTimespan(timespan)
    return !!years && years.firstYear === years.lastYear
}

export const getDateRangeLabel = (timespan: string): string =>
    isSingleYearTimespan(timespan) ? "Year" : "Date range"

const formatYear = (year: number, withEra = false): string =>
    year < 0 ? `${Math.abs(year)} BCE` : withEra ? `${year} CE` : `${year}`

export const getDateRange = (timespan: string): string | null => {
    const years = parseTimespan(timespan)
    if (!years) return null
    const { firstYear, lastYear } = years

    if (firstYear === lastYear) return formatYear(firstYear)

    // "500 BCE – 2000 CE"
    const spansEras = firstYear < 0 || lastYear < 0
    const formattedRange = [
        formatYear(firstYear),
        formatYear(lastYear, firstYear < 0),
    ]
    return formattedRange.join(spansEras ? " – " : "–")
}
