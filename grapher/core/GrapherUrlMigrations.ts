import { QueryParams } from "../../clientUtils/url"
import { Url } from "../../urls/Url"
import { UrlMigration, performUrlMigrations } from "../../urls/UrlMigration"
import { EntityUrlBuilder } from "./EntityUrlBuilder"

export const grapherUrlMigrations: UrlMigration[] = [
    (url) => {
        const { year, time } = url.queryParams.decoded
        if (!year) return url
        return url.updateQueryParams({
            year: undefined,
            time: time ?? year,
        })
    },
    (url) => {
        // need to use `_original` (still-encoded) URL params because we need to
        // distinguish between `+` and `%20` in legacy URLs
        const { country } = url.queryParams._original
        if (!country) return url
        return url.updateQueryParams({
            country: undefined,
            selection: EntityUrlBuilder.migrateEncodedLegacyCountryParam(
                country
            ),
        })
    },
]

export const legacyToCurrentGrapherUrl = (url: Url) =>
    performUrlMigrations(grapherUrlMigrations, url)

export const legacyToCurrentGrapherQueryParams = (
    queryStr: string
): QueryParams => {
    const url = Url.fromQueryStr(queryStr)
    return legacyToCurrentGrapherUrl(url).queryParams.decoded
}
