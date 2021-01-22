import { explorerUrlMigrationsById } from "../explorer/ExplorerUrlMigrations"
import { getExplorerRedirectForPath } from "../explorerAdmin/ExplorerRedirects"
import { Url } from "../urls/Url"

export const replaceIframesWithExplorerRedirectsInWordPressPost = (
    cheerio: CheerioStatic
) =>
    cheerio("iframe")
        .toArray()
        .forEach((el) => {
            let url = Url.fromURL(el.attribs["src"].trim())
            if (!url.pathname) return

            const explorerRedirect = getExplorerRedirectForPath(url.pathname)
            if (!explorerRedirect) return

            const { migrationId, baseQueryStr } = explorerRedirect
            const { migrateUrl } = explorerUrlMigrationsById[migrationId]
            url = migrateUrl(url, baseQueryStr)
            el.attribs["src"] = url.fullUrl
        })
