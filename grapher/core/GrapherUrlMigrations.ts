import { QueryParams } from "../../clientUtils/url"
import { Url } from "../../urls/Url"
import { UrlMigration, performUrlMigrations } from "../../urls/UrlMigration"
import { EntityUrlBuilder } from "./EntityUrlBuilder"
import { LegacyGrapherQueryParams } from "./GrapherInterface"

export const grapherUrlMigrations: UrlMigration[] = [
    (url) => {
        const { year, time } = url.queryParams
        if (!year) return url
        return url.updateQueryParams({
            year: undefined,
            time: time ?? year,
        })
    },
    (url) => {
        const { country } = url.queryParams
        if (!country) return url
        return url.updateQueryParams({
            country: undefined,
            selection: EntityUrlBuilder.migrateLegacyCountryParam(country!),
        })
    },
]

export const legacyToCurrentGrapherUrl = (url: Url) =>
    performUrlMigrations(grapherUrlMigrations, url)

export const legacyToCurrentGrapherQueryParams = (
    params: LegacyGrapherQueryParams
): QueryParams => {
    const url = Url.fromQueryParams(params)
    return legacyToCurrentGrapherUrl(url).queryParams
}
