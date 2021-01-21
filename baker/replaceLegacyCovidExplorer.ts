import { explorerUrlMigrationsById } from "../explorer/ExplorerUrlMigrations"
import { getExplorerRedirectForPath } from "../explorerAdmin/ExplorerRedirects"
import { Url } from "../urls/Url"

// Todo: remove this file eventually. Would server side redirects do it?
// this runs only at bake/wordpress/dev time and is not a clientside file.

// todo: remove
export const legacyCovidDashboardSlug = "coronavirus-data-explorer"

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
            // Replace Grapher iframe src with explorer src
            el.attribs["src"] = url.fullUrl
        })
