import { QueryParams } from "../../clientUtils/urls/UrlUtils"
import { Url } from "../../clientUtils/urls/Url"
import {
    UrlMigration,
    performUrlMigrations,
} from "../../clientUtils/urls/UrlMigration"
import { upgradeCountryQueryParam } from "./EntityUrlBuilder"

export const grapherUrlMigrations: UrlMigration[] = [
    (url) => {
        const { year, time } = url.queryParams.decoded
        if (!year) return url
        return url.updateQueryParams({
            year: undefined,
            time: time ?? year,
        })
    },
    upgradeCountryQueryParam,
]

export const legacyToCurrentGrapherUrl = (url: Url) =>
    performUrlMigrations(grapherUrlMigrations, url)

export const legacyToCurrentGrapherQueryParams = (
    queryStr: string
): QueryParams => {
    const url = Url.fromQueryStr(queryStr)
    return legacyToCurrentGrapherUrl(url).queryParams.decoded
}
