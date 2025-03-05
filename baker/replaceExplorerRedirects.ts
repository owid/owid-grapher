import {
    explorerUrlMigrationsById,
    migrateExplorerUrl,
} from "@ourworldindata/explorer"
import { getExplorerRedirectForPath } from "../explorerAdminServer/ExplorerRedirects.js"
import { Url } from "@ourworldindata/utils"

export const replaceIframesWithExplorerRedirectsInWordPressPost = (
    cheerio: cheerio.CheerioAPI
) =>
    cheerio("iframe")
        .toArray()
        .forEach((el) => {
            const srcUrl = Url.fromURL(el.attribs["src"].trim())
            const resolvedUrl = resolveExplorerRedirect(srcUrl)
            if (srcUrl === resolvedUrl) return

            el.attribs["src"] = resolvedUrl.fullUrl
        })

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
