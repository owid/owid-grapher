import { encodeXML } from "entities"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/serverSettings.js"
import {
    dayjs,
    countries,
    DbPlainChart,
    DbRawPostGdoc,
    OwidGdocType,
} from "@ourworldindata/utils"
import {
    EXPLORERS_ROUTE_FOLDER,
    ExplorerProgram,
} from "@ourworldindata/explorer"
import * as db from "../db/db.js"
import urljoin from "url-join"
import { countryProfileSpecs } from "../site/countryProfileProjects.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"

import { getPostsFromSnapshots } from "../db/model/Post.js"
import { calculateDataInsightIndexPageCount } from "../db/model/Gdoc/gdocUtils.js"
import { getMinimalAuthors } from "../db/model/Gdoc/GdocAuthor.js"

interface SitemapUrl {
    loc: string
    lastmod?: string
}

const xmlify = (url: SitemapUrl) => {
    const escapedUrl = encodeXML(url.loc)

    if (url.lastmod)
        return `    <url>
        <loc>${escapedUrl}</loc>
        <lastmod>${url.lastmod}</lastmod>
    </url>`

    return `    <url>
        <loc>${escapedUrl}</loc>
    </url>`
}

const explorerToSitemapUrl = (program: ExplorerProgram): SitemapUrl => {
    const url = `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${program.slug}`
    const lastmod = program.lastCommit?.date
        ? dayjs(program.lastCommit.date).format("YYYY-MM-DD")
        : undefined

    return {
        loc: url,
        lastmod,
    }
}

async function getGdocPosts(knex: db.KnexReadonlyTransaction) {
    return db.knexRaw<DbRawPostGdoc>(
        knex,
        `-- sql
        SELECT
        slug,
        updatedAt
    FROM
        posts_gdocs
    WHERE
        published = 1
        AND type IN (:types)
        AND publishedAt <= NOW()
    ORDER BY publishedAt DESC`,
        {
            types: [
                OwidGdocType.Article,
                OwidGdocType.LinearTopicPage,
                OwidGdocType.TopicPage,
                OwidGdocType.AboutPage,
            ],
        }
    )
}

export const makeSitemap = async (
    explorerAdminServer: ExplorerAdminServer,
    knex: db.KnexReadonlyTransaction
) => {
    const alreadyPublishedViaGdocsSlugsSet =
        await db.getSlugsWithPublishedGdocsSuccessors(knex)
    const postsApi = await getPostsFromSnapshots(
        knex,
        undefined,
        (postrow) => !alreadyPublishedViaGdocsSlugsSet.has(postrow.slug)
    )
    const gdocPosts = await getGdocPosts(knex)
    const authorPages = await getMinimalAuthors(knex)

    const publishedDataInsights = await db.getPublishedDataInsights(knex)
    const dataInsightFeedPageCount = calculateDataInsightIndexPageCount(
        publishedDataInsights.length
    )

    const charts = await db.knexRaw<
        Pick<DbPlainChart, "updatedAt"> & { slug: string }
    >(
        knex,
        `-- sql
            SELECT c.updatedAt, cc.slug
            FROM charts c
            JOIN chart_configs cc ON cc.id = c.configId
            WHERE
                cc.full->"$.isPublished" = true
        `
    )

    const STATIC_PAGES = ["/explorers", "/data", "/search", "/donate"]

    const explorers = await explorerAdminServer.getAllPublishedExplorers(knex)

    let urls = countries.map((c) => ({
        loc: urljoin(BAKED_BASE_URL, "country", c.slug),
    })) as SitemapUrl[]

    urls = urls
        .concat(
            ...STATIC_PAGES.map((path) => {
                return [{ loc: urljoin(BAKED_BASE_URL, path) }]
            })
        )
        .concat(
            ...countryProfileSpecs.map((spec) => {
                return countries.map((c) => ({
                    loc: urljoin(BAKED_BASE_URL, spec.rootPath, c.slug),
                }))
            })
        )
        .concat(
            postsApi.map((p) => ({
                loc: urljoin(BAKED_BASE_URL, p.slug),
                lastmod: dayjs(p.modified_gmt).format("YYYY-MM-DD"),
            }))
        )
        .concat(
            gdocPosts.map((p) => ({
                loc: urljoin(BAKED_BASE_URL, p.slug),
                lastmod: dayjs(p.updatedAt).format("YYYY-MM-DD"),
            }))
        )
        .concat(
            publishedDataInsights.map((d) => ({
                loc: urljoin(BAKED_BASE_URL, "data-insights", d.slug),
                lastmod: dayjs(d.updatedAt).format("YYYY-MM-DD"),
            }))
        )
        .concat(
            // Data insight index pages: /data-insights, /data-insights/2, /data-insights/3, etc.
            Array.from({ length: dataInsightFeedPageCount }, (_, i) => ({
                loc: urljoin(
                    BAKED_BASE_URL,
                    "data-insights",
                    i === 0 ? "" : `/${i + 1}`
                ),
                lastmod: dayjs(publishedDataInsights[0].updatedAt).format(
                    "YYYY-MM-DD"
                ),
            }))
        )
        .concat(
            charts.map((c) => ({
                loc: urljoin(BAKED_GRAPHER_URL, c.slug),
                lastmod: dayjs(c.updatedAt).format("YYYY-MM-DD"),
            }))
        )
        .concat(explorers.map(explorerToSitemapUrl))
        .concat(
            authorPages.map((a) => ({
                loc: urljoin(BAKED_BASE_URL, "team", a.slug),
                lastmod: dayjs(a.updatedAt).format("YYYY-MM-DD"),
            }))
        )

    const sitemap = `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => xmlify(url)).join("\n")}
</urlset>`

    return sitemap
}
