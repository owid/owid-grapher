import {
    QueryParams,
    Url,
    UrlMigration,
    performUrlMigrations,
} from "@ourworldindata/utils"
import { migrateSelectedEntityNamesParam } from "./EntityUrlBuilder"

export const grapherUrlMigrations: UrlMigration[] = [
    (url: Url): Url => {
        const { year, time } = url.queryParams
        if (!year) return url
        return url.updateQueryParams({
            year: undefined,
            time: time ?? year,
        })
    },
    migrateSelectedEntityNamesParam,
]

export const legacyToCurrentGrapherUrl = (url: Url): Url =>
    performUrlMigrations(grapherUrlMigrations, url)

export const legacyToCurrentGrapherQueryParams = (
    queryStr: string
): QueryParams => {
    const url = Url.fromQueryStr(queryStr)
    return legacyToCurrentGrapherUrl(url).queryParams
}
