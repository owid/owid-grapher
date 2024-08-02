import { encodeXML } from "entities"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/serverSettings.js"
import {
    dayjs,
    countries,
    queryParamsToStr,
    ChartsTableName,
} from "@ourworldindata/utils"
import * as db from "../db/db.js"
import urljoin from "url-join"
import { countryProfileSpecs } from "../site/countryProfileProjects.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { EXPLORERS_ROUTE_FOLDER } from "../explorer/ExplorerConstants.js"
import { ExplorerProgram } from "../explorer/ExplorerProgram.js"
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

const explorerToSitemapUrl = (program: ExplorerProgram): SitemapUrl[] => {
    const baseUrl = `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${program.slug}`
    const lastmod = program.lastCommit?.date
        ? dayjs(program.lastCommit.date).format("YYYY-MM-DD")
        : undefined

    if (program.indexViewsSeparately) {
        // return an array containing the URLs to each view of the explorer
        return program.decisionMatrix
            .allDecisionsAsQueryParams()
            .map((params) => ({
                loc: baseUrl + queryParamsToStr(params),
                lastmod,
            }))
    } else {
        return [
            {
                loc: baseUrl,
                lastmod,
            },
        ]
    }
}

// TODO: this transaction is only RW because somewhere inside it we fetch images
export const makeSitemap = async (
    explorerAdminServer: ExplorerAdminServer,
    knex: db.KnexReadWriteTransaction
) => {
    const alreadyPublishedViaGdocsSlugsSet =
        await db.getSlugsWithPublishedGdocsSuccessors(knex)
    const postsApi = await getPostsFromSnapshots(
        knex,
        undefined,
        (postrow) => !alreadyPublishedViaGdocsSlugsSet.has(postrow.slug)
    )
    const gdocPosts = await db.getPublishedGdocPosts(knex)
    const authorPages = await getMinimalAuthors(knex)

    const publishedDataInsights = await db.getPublishedDataInsights(knex)
    const dataInsightFeedPageCount = calculateDataInsightIndexPageCount(
        publishedDataInsights.length
    )

    const charts = (await knex
        .table(ChartsTableName)
        .select(knex.raw(`updatedAt, config->>"$.slug" AS slug`))
        .whereRaw('config->"$.isPublished" = true')) as {
        updatedAt: Date
        slug: string
    }[]

    const explorers = await explorerAdminServer.getAllPublishedExplorers()

    let urls = countries.map((c) => ({
        loc: urljoin(BAKED_BASE_URL, "country", c.slug),
    })) as SitemapUrl[]

    urls = urls
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
        .concat(explorers.flatMap(explorerToSitemapUrl))
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
