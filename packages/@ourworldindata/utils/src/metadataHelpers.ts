import {
    OwidOrigin,
    OwidVariableWithSource,
    OwidProcessingLevel,
    DisplaySource,
    IndicatorTitleWithFragments,
    OwidSource,
    OwidVariableWithSourceAndDimension,
    LinkedIndicator,
    joinTitleFragments,
} from "@ourworldindata/types"
import { compact, uniq, last, excludeUndefined } from "./Util"
import dayjs from "./dayjs.js"

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

export const splitSourceTextIntoFragments = (
    text: string | undefined
): string[] => {
    return text ? text.split(";").map((fragment) => fragment.trim()) : []
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

    const originAttributionFragments = getOriginAttributionFragments(
        variable.origins
    )
    const name = variable.source?.name
    return uniq(compact([name, ...originAttributionFragments]))
}

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
        path.split("/")
    return { channel, producer, version, dataset, table, indicator }
}

export const formatAuthors = ({
    authors,
    requireMax,
    forBibtex,
}: {
    authors: string[]
    requireMax?: boolean
    forBibtex?: boolean
}): string => {
    if (requireMax && !authors.includes("Max Roser"))
        authors = [...authors, "Max Roser"]

    let authorsText = authors.slice(0, -1).join(forBibtex ? " and " : ", ")
    if (authorsText.length === 0) authorsText = authors[0]
    else authorsText += ` and ${last(authors)}`

    return authorsText
}

const isDate = (date: string): boolean => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    return !!date.match(dateRegex)
}

export const getLastUpdatedFromVariable = (
    variable: Pick<OwidVariableWithSource, "catalogPath" | "origins">
): string | undefined => {
    // if possible, extract date from the catalog path
    const version = getETLPathComponents(variable.catalogPath ?? "")?.version
    if (version && isDate(version)) return version

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

export const getNextUpdateFromVariable = (
    variable: Pick<OwidVariableWithSource, "catalogPath" | "updatePeriodDays">
): string | undefined => {
    const lastUpdated = getLastUpdatedFromVariable(variable)
    let nextUpdate = undefined
    if (variable.updatePeriodDays) {
        const date = dayjs(lastUpdated)
        const nextUpdateDate = date.add(variable.updatePeriodDays, "day")
        // If the next update date is in the past, we set it to the next month
        if (nextUpdateDate.isBefore(dayjs()))
            nextUpdate = dayjs().add(1, "month")
        else nextUpdate = nextUpdateDate
    }
    return nextUpdate?.format("YYYY-MM-DD")
}

export const getPhraseForProcessingLevel = (
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

const getYearSuffixFromOrigin = (o: OwidOrigin): string => {
    const year = o.dateAccessed
        ? dayjs(o.dateAccessed, ["YYYY-MM-DD", "YYYY"]).year()
        : o.datePublished
        ? dayjs(o.datePublished, ["YYYY-MM-DD", "YYYY"]).year()
        : undefined
    if (year) return ` (${year})`
    else return ""
}

export const getCitationShort = (
    origins: OwidOrigin[],
    attributions: string[],
    owidProcessingLevel: OwidProcessingLevel | undefined
): string => {
    const producersWithYear = uniq(
        origins.map((o) => `${o.producer}${getYearSuffixFromOrigin(o)}`)
    )
    const processingLevelPhrase =
        getPhraseForProcessingLevel(owidProcessingLevel)

    const attributionFragments = attributions ?? producersWithYear
    const attributionPotentiallyShortened =
        attributionFragments.length > 3
            ? `${attributionFragments[0]} and other sources`
            : attributionFragments.join("; ")

    return `${attributionPotentiallyShortened} – ${processingLevelPhrase} by Our World in Data`
}

export const getCitationLong = (
    indicatorTitle: IndicatorTitleWithFragments,
    origins: OwidOrigin[],
    source: OwidSource | undefined,
    attributions: string[],
    attributionShort: string | undefined,
    titleVariant: string | undefined,
    owidProcessingLevel: OwidProcessingLevel | undefined,
    canonicalUrl: string | undefined
): string => {
    const sourceShortName =
        attributionShort && titleVariant
            ? `${attributionShort} – ${titleVariant}`
            : attributionShort || titleVariant
    const producersWithYear = uniq(
        origins.map((o) => `${o.producer}${getYearSuffixFromOrigin(o)}`)
    )
    const processingLevelPhrase =
        getPhraseForProcessingLevel(owidProcessingLevel)

    const attributionFragments = attributions ?? producersWithYear
    const attributionUnshortened = attributionFragments.join("; ")
    const citationLonger = `${attributionUnshortened} – ${processingLevelPhrase} by Our World in Data`
    const titleWithOptionalFragments = excludeUndefined([
        indicatorTitle.title,
        sourceShortName,
    ]).join(" – ")
    const originsLong = uniq(
        origins.map(
            (o) =>
                `${o.producer}, “${o.title ?? o.titleSnapshot}${
                    o.versionProducer ? " " + o.versionProducer : ""
                }”`
        )
    ).join("; ")
    const today = dayjs().format("MMMM D, YYYY")
    return excludeUndefined([
        `${citationLonger}.`,
        `“${titleWithOptionalFragments}” [dataset].`,
        originsLong
            ? `${originsLong} [original data].`
            : source?.name
            ? `${source?.name} [original data].`
            : undefined,
        canonicalUrl ? `Retrieved ${today} from ${canonicalUrl}` : undefined,
    ]).join(" ")
}

export const formatSourceDate = (
    date: string | undefined,
    format: string
): string | null => {
    const parsedDate = dayjs(date ?? "", ["YYYY-MM-DD", "DD/MM/YYYY"])
    if (!parsedDate.isValid()) return date || null
    return parsedDate.format(format)
}

export function grabMetadataForGdocLinkedIndicator(
    metadata: OwidVariableWithSourceAndDimension
): Omit<LinkedIndicator, "id"> {
    return {
        title:
            metadata.presentation?.titlePublic ||
            metadata.presentation?.grapherConfigETL?.title ||
            metadata.display?.name ||
            metadata.name ||
            "",
        attributionShort: joinTitleFragments(
            metadata.presentation?.attributionShort,
            metadata.presentation?.titleVariant
        ),
    }
}
