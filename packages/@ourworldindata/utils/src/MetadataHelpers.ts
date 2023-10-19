import dayjs from "./dayjs.js"
import { OwidVariableWithSource } from "./OwidVariable.js"
import { OwidOrigin } from "./OwidOrigin.js"
import { compact, uniq } from "./Util"

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
    if (
        variable.presentation?.attribution &&
        variable.presentation?.attribution !== ""
    )
        return variable.presentation?.attribution
    const originAttributionFragments = getOriginAttributionFragments(
        variable.origins
    )
    const sourceName = variable.source?.name
    return uniq(compact([sourceName, ...originAttributionFragments])).join("; ")
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

export const getLastUpdatedFromVariable = (
    variable: OwidVariableWithSource
): string | undefined => {
    return getETLPathComponents(variable.catalogPath ?? "")?.version
}

export const getNextUpdateFromVariable = (
    variable: OwidVariableWithSource
): string | undefined => {
    const lastUpdated = getLastUpdatedFromVariable(variable)
    if (lastUpdated && variable.updatePeriodDays) {
        const date = dayjs(lastUpdated)
        return date.add(variable.updatePeriodDays, "day").format("MMMM YYYY")
    }
    return undefined
}
