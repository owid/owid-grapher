import * as db from "db/db"
import * as wpdb from "db/wpdb"
import { getCountryDetectionRedirects } from "utils/countries"

export const getRedirects = async () => {
    const redirects = [
        // RSS feed
        "/feed /atom.xml 302!",

        // Backwards compatibility-- admin urls
        "/wp-admin/* https://owid.cloud/wp/wp-admin/:splat 301",
        "/grapher/admin/* https://owid.cloud/grapher/admin/:splat 301",

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

        // Backwards compatibility-- public urls
        "/entries/* /:splat 301",
        "/entries /#entries 302",
        "/data/food-agriculture/* /:splat 301",
        "/data/political-regimes/* /:splat 301",
        "/data/population-growth-vital-statistics/* /:splat 301",
        "/data/growth-and-distribution-of-prosperity/* /:splat 301",

        // Backwards compatibility-- grapher url style
        "/chart-builder/* /grapher/:splat 301",
        "/grapher/public/* /grapher/:splat 301",
        "/grapher/view/* /grapher/:splat 301",

        "/slides/* https://slides.ourworldindata.org/:splat 301",
    ]

    getCountryDetectionRedirects().forEach((redirect) =>
        redirects.push(redirect)
    )

    // Redirects from Wordpress admin UI
    const rows = await wpdb.query(
        `SELECT url, action_data, action_code FROM wp_redirection_items WHERE status = 'enabled'`
    )
    redirects.push(
        ...rows.map(
            (row) =>
                `${row.url.replace(/__/g, "/")} ${row.action_data.replace(
                    /__/g,
                    "/"
                )} ${row.action_code}!`
        )
    )

    // Redirect /grapher/latest
    const latestRows = await db.query(
        `SELECT JSON_EXTRACT(config, "$.slug") as slug FROM charts where starred=1`
    )
    for (const row of latestRows) {
        redirects.push(`/grapher/latest /grapher/${JSON.parse(row.slug)} 302`)
    }

    // Redirect old slugs to new slugs
    const chartRedirectRows = await db.query(`
    SELECT chart_slug_redirects.slug, chart_id, JSON_EXTRACT(charts.config, "$.slug") as trueSlug
    FROM chart_slug_redirects INNER JOIN charts ON charts.id=chart_id
`)

    for (const row of chartRedirectRows) {
        const trueSlug = JSON.parse(row.trueSlug)
        if (row.slug !== trueSlug) {
            redirects.push(`/grapher/${row.slug} /grapher/${trueSlug} 302!`)
        }
    }

    return redirects
}
