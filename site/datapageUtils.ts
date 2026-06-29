import * as _ from "lodash-es"
import { OwidOrigin } from "@ourworldindata/types"
import { getYearSuffixFromOrigin } from "@ourworldindata/utils"

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
