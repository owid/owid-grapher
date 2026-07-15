import * as db from "../db/db.js"
import { getSiteRedirects } from "../db/model/Redirect.js"
import { getRecentChartSlugRedirects } from "./redirectsFromDb.js"
import { getRecentMultiDimRedirects } from "../db/model/MultiDimRedirects.js"
import { buildLatestPagePath } from "../site/latest/latestUtils.js"

export const getCloudflarePagesRedirects = async (
    knex: db.KnexReadonlyTransaction
) => {
    const staticRedirects = [
        // RSS feed
        "/feed /atom.xml 302",

        // Entries and blog (we should keep these for a while)
        "/entries / 302",
        "/blog /latest 301",

        // Deprecated country index pages
        "/countries /search 301",

        // Retired /data-insights index page (bare + paginated URLs only)
        // collapses to the unified /latest feed filtered to data insights.
        // We enumerate numeric pages explicitly rather than using a
        // `/data-insights/*` wildcard: the wildcard would 301 any unknown
        // slug, and if a browser or CDN cached that redirect we'd shadow
        // the slug if we ever publish it. Unlikely, but cheap to avoid.
        // Numeric-only slugs can't collide with real (kebab-case)
        // permalinks. Range covers the observed historical max page
        // count (~22) plus headroom.
        //
        // Per Metabase as of 2026-05-01, paginated URLs (/data-insights/2,
        // /3, …) still get ~7.5k pageviews / 90 days combined. Re-check
        // after 2026-08-01: if traffic has decayed to noise, drop these.
        `/data-insights ${buildLatestPagePath("data-insight")} 301`,
        ...Array.from(
            { length: 25 },
            (_unused, i) =>
                `/data-insights/${i + 1} ${buildLatestPagePath("data-insight")} 301`
        ),
    ]

    // Dynamic redirects are all redirects that contain an asterisk
    const dynamicRedirects = [
        // Always remove trailing slash
        "/*/ /:splat 301",

        // TODO: this should only get triggered by external hits (indexed .pdf files for instance)
        // and should be removed when no evidence of these inbound links can be found.
        "/wp-content/uploads/* /uploads/:splat 301",
        // TODO: temporary fix for the /blog page thumbnails, which paths are not being
        // transformed through the formatting step. Potentially applies to other
        // pages as well.
        "/app/uploads/* /uploads/:splat 301",

        // Backwards compatibility-- old Max stuff that isn't static-friendly
        "/roser/* https://www.maxroser.com/roser/:splat 301",
        "/uploads/nvd3/* https://www.maxroser.com/owidUploads/nvd3/:splat 301",
        "/uploads/datamaps/* https://www.maxroser.com/owidUploads/datamaps/:splat 301",
        "/slides/Max_PPT_presentations/* https://www.maxroser.com/slides/Max_PPT_presentations/:splat 301",
        "/slides/Max_Interactive_Presentations/* https://www.maxroser.com/slides/Max_Interactive_Presentations/:splat 301",

        // Entries and blog (we should keep these for a while).
        "/entries/* /:splat 301",

        // The retired SSR /latest exposed /latest/page/:pageno; the SPA
        // uses infinite scroll and has no concept of pages, so the page
        // number is dropped on redirect.
        "/latest/page/* /latest 301",

        // Was `/blog/* /latest/:splat 301`, presumably to forward
        // /blog/page/N to the SSR /latest's matching /latest/page/N. With
        // those paginated routes gone (see above) and /latest having no
        // /:slug route, the :splat lands on 404 for every input. Drop it.
        // Specific /blog/<slug> recoveries live in DB-backed siteRedirects
        // (emitted before this rule) and still win.
        "/blog/* /latest 301",

        // Backwards compatibility-- grapher url style
        "/chart-builder/* /grapher/:splat 301",
        "/grapher/public/* /grapher/:splat 301",
        "/grapher/view/* /grapher/:splat 301",

        // Slides
        "/slides/* https://slides.ourworldindata.org/:splat 301",

        // These are needed for the Cloudflare Pages migration

        // Wordpress uploads, mostly images
        // Example: https://assets.ourworldindata.org/uploads/2022/03/Age-of-onset-depression2-01-1-800x521.png
        "/uploads/* https://assets.ourworldindata.org/uploads/:splat 301",

        // Automatic static grapher exports for graphers embedded into Wordpress, taking query params such as `country=USA` into account
        // Example: https://assets.ourworldindata.org/exports/absolute-change-co2-a847e6c96bb2640c05a8cd075949d1bb_v26_850x600.svg
        "/exports/* https://assets.ourworldindata.org/exports/:splat 301",

        // Automatic static grapher exports for every grapher chart
        // Example: https://assets.ourworldindata.org/grapher/exports/absolute-change-co2.svg
        "/grapher/exports/* https://ourworldindata.org/grapher/:splat 301",

        // Old country profiles
        // Example: /co2/country/canada --> /profile/co2/canada
        "/:slug/country/:country /profile/:slug/:country 301",
    ]

    // Get redirects from the database (exported from the Wordpress DB)
    // Redirects are assumed to be trailing-slash-free (see syncRedirectsToGrapher.ts)
    // Split into static and dynamic: Cloudflare requires all dynamic (wildcard)
    // redirects to be at the very end of the _redirects file.
    const allSiteRedirects = (await getSiteRedirects(knex)).map(
        (row) => `${row.source} ${row.target} ${row.code}`
    )
    const siteRedirects = allSiteRedirects.filter((r) => !r.includes("*"))
    const dynamicSiteRedirects = allSiteRedirects.filter((r) => r.includes("*"))

    // Prevent Cloudflare from serving outdated non-site pages (grapher,
    // explorers, multi-dims), which can remain in the cache for up to a week.
    // This is necessary since in the Cloudflare Functions we take into
    // consideration the grapher and multi-dim redirects only when the route
    // returns a 404, which won't be the case if the page is still cached.
    // https://developers.cloudflare.com/pages/configuration/serving-pages/#asset-retention
    const recentChartSlugRedirects = (
        await getRecentChartSlugRedirects(knex)
    ).map((row) => `${row.source} ${row.target} 302`)
    const recentMultiDimRedirects = (
        await getRecentMultiDimRedirects(knex)
    ).map((row) => `${row.source} ${row.target} 302`)

    // Add newlines in between so we get some more overview
    return [
        ...staticRedirects,
        "",
        ...recentChartSlugRedirects,
        "",
        ...recentMultiDimRedirects,
        "",
        ...siteRedirects,
        "",
        // Cloudflare requires all dynamic redirects to be at the very end of the _redirects file
        ...dynamicSiteRedirects,
        ...dynamicRedirects,
    ]
}
