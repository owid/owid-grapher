import {
    explorerUrlMigrationsById,
    migrateExplorerUrl,
} from "../explorer/urlMigrations/ExplorerUrlMigrations"
import { getExplorerRedirectForPath } from "../explorerAdmin/ExplorerRedirects"
import { Url } from "../clientUtils/urls/Url"

export const replaceIframesWithExplorerRedirectsInWordPressPost = (
    cheerio: CheerioStatic
) =>
    cheerio("iframe")
        .toArray()
        .forEach((el) => {
            let url = Url.fromURL(el.attribs["src"].trim())
            if (!url.pathname) return

            const explorerRedirect = getExplorerRedirectForPath(url.pathname)
            if (explorerRedirect) {
                const { migrationId, baseQueryStr } = explorerRedirect
                const { migrateUrl } = explorerUrlMigrationsById[migrationId]
                url = migrateUrl(url, baseQueryStr)
            }

            url = migrateExplorerUrl(url)

            el.attribs["src"] = url.fullUrl
        })
