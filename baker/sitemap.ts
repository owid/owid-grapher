import { encodeXML } from "entities"
import { Chart } from "../db/model/Chart.js"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/serverSettings.js"
import { dayjs, countries, queryParamsToStr } from "@ourworldindata/utils"
import * as db from "../db/db.js"
import urljoin from "url-join"
import { countryProfileSpecs } from "../site/countryProfileProjects.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { EXPLORERS_ROUTE_FOLDER } from "../explorer/ExplorerConstants.js"
import { ExplorerProgram } from "../explorer/ExplorerProgram.js"
import { GdocPost } from "../db/model/Gdoc/GdocPost.js"
import { getPostsFromSnapshots } from "../db/model/Post.js"

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

export const makeSitemap = async (explorerAdminServer: ExplorerAdminServer) => {
    // TODO: the knex instance should be handed down as a parameter
    const knex = db.knexInstance()
    const alreadyPublishedViaGdocsSlugsSet =
        await db.getSlugsWithPublishedGdocsSuccessors(knex)
    const postsApi = await getPostsFromSnapshots(
        undefined,
        (postrow) => !alreadyPublishedViaGdocsSlugsSet.has(postrow.slug)
    )
    const gdocPosts = await GdocPost.getPublishedGdocs()
    const charts = (await db
        .knexTable(Chart.table)
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
            charts.map((c) => ({
                loc: urljoin(BAKED_GRAPHER_URL, c.slug),
                lastmod: dayjs(c.updatedAt).format("YYYY-MM-DD"),
            }))
        )
        .concat(explorers.flatMap(explorerToSitemapUrl))

    const sitemap = `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => xmlify(url)).join("\n")}
</urlset>`

    return sitemap
}
