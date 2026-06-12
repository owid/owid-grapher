import * as _ from "lodash-es"
import { OwidOrigin } from "@ourworldindata/types"
import dayjs from "dayjs"

export function getYearSuffixFromOrigin(origin: OwidOrigin) {
    const year = origin.dateAccessed
        ? dayjs(origin.dateAccessed, ["YYYY-MM-DD", "YYYY"]).year()
        : origin.datePublished
          ? dayjs(origin.datePublished, ["YYYY-MM-DD", "YYYY"]).year()
          : undefined
    if (year) return ` (${year})`
    else return ""
}

export function getProducersFromYears(origins: OwidOrigin[]) {
    return _.uniq(
        origins.map((o) => `${o.producer}${getYearSuffixFromOrigin(o)}`)
    )
}

export function getAttributionUnshortened(datapageData: {
    attributions?: string[]
    origins: OwidOrigin[]
}) {
    const producersWithYear = getProducersFromYears(datapageData.origins)
    const attributionFragments = datapageData.attributions ?? producersWithYear
    return attributionFragments.join("; ")
}
