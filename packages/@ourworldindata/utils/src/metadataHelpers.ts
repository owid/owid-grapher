import { OwidOrigin } from "./OwidOrigin"
import { OwidProcessingLevel, OwidVariableWithSource } from "./OwidVariable"
import { DisplaySource } from "./owidTypes"
import { compact, uniq, last, excludeUndefined } from "./Util"
import dayjs from "./dayjs.js"

export function getOriginAttributionFragments(
    origins: OwidOrigin[] | undefined
): string[] {
    return origins
        ? origins.map((origin) => {
              const yearPublished = origin.datePublished
                  ? dayjs(origin.datePublished, ["YYYY", "YYYY-MM-DD"]).year()
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
            return "with major adaptations by Our World In Data"
        case "minor":
            return "with minor processing by Our World In Data"
        default:
            return "processed by Our World In Data"
    }
}

const prepareOriginForDisplay = (origin: OwidOrigin): DisplaySource => {
    let label = origin.producer ?? ""
    if (origin.title && origin.title !== label) {
        label += " - " + origin.title
    }

    return {
        label,
        description: origin.description,
        retrievedOn: origin.dateAccessed,
        retrievedFrom: origin.urlMain ? [origin.urlMain] : undefined,
        citation: origin.citationFull,
    }
}

export const prepareSourcesForDisplay = (
    variable: Pick<OwidVariableWithSource, "origins" | "source" | "description">
): DisplaySource[] => {
    const { origins, source, description } = variable

    const sourcesForDisplay =
        origins?.map((origin: OwidOrigin) => prepareOriginForDisplay(origin)) ??
        []

    if (
        source?.name &&
        (description ||
            source?.dataPublishedBy ||
            source?.retrievedDate ||
            source?.link)
    ) {
        sourcesForDisplay.push({
            label: source?.name,
            description,
            dataPublishedBy: source?.dataPublishedBy,
            retrievedOn: source?.retrievedDate,
            retrievedFrom: splitSourceTextIntoFragments(source?.link),
        })
    }

    return sourcesForDisplay
}
