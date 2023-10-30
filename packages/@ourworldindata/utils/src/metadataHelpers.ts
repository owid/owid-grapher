import { OwidOrigin } from "./OwidOrigin"
import { OwidProcessingLevel, OwidVariableWithSource } from "./OwidVariable"
import { compact, uniq, last } from "./Util"
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

export function getAttributionFromVariable(
    variable: OwidVariableWithSource
): string {
    return getAttributionFragmentsFromVariable(variable).join("; ")
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
    const sourceName = variable.source?.name
    return uniq(compact([sourceName, ...originAttributionFragments]))
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

export const getLastUpdatedFromVariable = (
    variable: Pick<OwidVariableWithSource, "catalogPath">
): string | undefined => {
    return getETLPathComponents(variable.catalogPath ?? "")?.version
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
            nextUpdate = dayjs().add(1, "month").format("MMMM YYYY")
        else nextUpdate = nextUpdateDate.format("MMMM YYYY")
    }
    return nextUpdate
}

export const getPhraseForProcessingLevel = (
    processingLevel: OwidProcessingLevel
) => (processingLevel === "major" ? "major adaptations" : "minor processing")
