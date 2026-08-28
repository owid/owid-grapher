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

    const originAttributions = getOriginAttributions(variable.origins).map(
        (attribution) => attribution.label
    )
    const name = variable.source?.name
    return _.uniq(_.compact([name, ...originAttributions]))
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
    attributionText: string,
    owidProcessingLevel: OwidProcessingLevel | undefined
): string => {
    const attribution = attributionText || OWID_ATTRIBUTION
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
    const titleFragments =
        attributionShort && titleVariant
            ? `${attributionShort} – ${titleVariant}`
            : attributionShort || titleVariant
    const attributionWithProcessing = getAttributionWithProcessing(
        formatAttributions(attributions),
        owidProcessingLevel
    )
    const titleWithFragments = excludeUndefined([
        indicatorTitle.title,
        titleFragments,
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
