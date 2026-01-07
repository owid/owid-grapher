import {
    explorerUrlMigrationsById,
    migrateExplorerUrl,
} from "@ourworldindata/explorer"
import { getExplorerRedirectForPath } from "../explorerAdminServer/ExplorerRedirects.js"
import { Url } from "@ourworldindata/utils"

export const resolveExplorerRedirect = (url: Url): Url => {
    if (!url.pathname) return url

    let tmpUrl
    const explorerRedirect = getExplorerRedirectForPath(url.pathname)
    if (explorerRedirect) {
        const { migrationId, baseQueryStr } = explorerRedirect
        const { migrateUrl } = explorerUrlMigrationsById[migrationId]
        tmpUrl = migrateUrl(url, baseQueryStr)
    }

    return migrateExplorerUrl(tmpUrl ?? url)
}
