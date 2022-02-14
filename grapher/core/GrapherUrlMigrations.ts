import { QueryParams } from "../../clientUtils/urls/UrlUtils.js"
import { Url } from "../../clientUtils/urls/Url.js"
import {
    UrlMigration,
    performUrlMigrations,
} from "../../clientUtils/urls/UrlMigration.js"
import { migrateSelectedEntityNamesParam } from "./EntityUrlBuilder.js"

export const grapherUrlMigrations: UrlMigration[] = [
    (url): Url => {
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
