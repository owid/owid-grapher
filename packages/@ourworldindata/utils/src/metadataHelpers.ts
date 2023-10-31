import { OwidOrigin } from "./OwidOrigin"
import { OwidSource } from "./OwidSource"
import { OwidProcessingLevel, OwidVariableWithSource } from "./OwidVariable"
import { compact, uniq, last, zip } from "./Util"
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

const getAttributionFragmentsFromSource = (
    source: OwidSource | undefined,
    { linkify } = { linkify: false }
): string[] => {
    if (!source || !source.dataPublishedBy) return []

    const fragments = splitSourceTextIntoFragments(source.dataPublishedBy)

    if (!linkify) return fragments

    const links = splitSourceTextIntoFragments(source.link)

    // if the number of fragments and links isn't the same,
    // we can't safely match them up
    if (fragments.length !== links.length) return fragments

    const linkifiedFragments = zip(fragments, links).map(
        ([fragment, link]) => `[${fragment}](${link})`
    )

    return linkifiedFragments
}

export function getAttributionFragmentsFromVariable(
    variable: Pick<
        OwidVariableWithSource,
        "presentation" | "origins" | "source"
    >,
    { linkify } = { linkify: false }
): string[] {
    if (
        variable.presentation?.attribution &&
        variable.presentation?.attribution !== ""
    )
        return [variable.presentation?.attribution]

    const originAttributionFragments = getOriginAttributionFragments(
        variable.origins
    )
    const sourceAttributionFragments = getAttributionFragmentsFromSource(
        variable.source,
        { linkify }
    )

    const attributionFragments = uniq(
        compact([...sourceAttributionFragments, ...originAttributionFragments])
    )

    return attributionFragments
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
