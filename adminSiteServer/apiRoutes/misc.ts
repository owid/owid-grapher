// Get an ArchieML output of all the work produced by an author. This includes
// gdoc articles, gdoc modular/linear topic pages and wordpress modular topic
// pages. Data insights are excluded. This is used to manually populate the
// [.secondary] section of the {.research-and-writing} block of author pages

import { DbRawPostGdoc, JsonError } from "@ourworldindata/types"

import * as db from "../../db/db.js"
import * as lodash from "lodash"
import path from "path"
import { expectInt } from "../../serverUtils/serverUtil.js"
import { Request } from "../authentication.js"
import e from "express"
// using the alternate template, which highlights topics rather than articles.
export async function fetchAllWork(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    type WordpressPageRecord = {
        isWordpressPage: number
    } & Record<
        "slug" | "title" | "subtitle" | "thumbnail" | "authors" | "publishedAt",
        string
    >
    type GdocRecord = Pick<DbRawPostGdoc, "id" | "publishedAt">

    const author = req.query.author
    const gdocs = await db.knexRaw<GdocRecord>(
        trx,
        `-- sql
            SELECT id, publishedAt
            FROM posts_gdocs
            WHERE JSON_CONTAINS(content->'$.authors', ?)
            AND type NOT IN ("data-insight", "fragment")
            AND published = 1
    `,
        [`"${author}"`]
    )

    // type: page
    const wpModularTopicPages = await db.knexRaw<WordpressPageRecord>(
        trx,
        `-- sql
        SELECT
            wpApiSnapshot->>"$.slug" as slug,
            wpApiSnapshot->>"$.title.rendered" as title,
            wpApiSnapshot->>"$.excerpt.rendered" as subtitle,
            TRUE as isWordpressPage,
            wpApiSnapshot->>"$.authors_name" as authors,
            wpApiSnapshot->>"$.featured_media_paths.medium_large" as thumbnail,
            wpApiSnapshot->>"$.date" as publishedAt
        FROM posts p
        WHERE wpApiSnapshot->>"$.content" LIKE '%topic-page%'
        AND JSON_CONTAINS(wpApiSnapshot->'$.authors_name', ?)
        AND wpApiSnapshot->>"$.status" = 'publish'
        AND NOT EXISTS (
            SELECT 1 FROM posts_gdocs pg
            WHERE pg.slug = p.slug
            AND pg.content->>'$.type' LIKE '%topic-page'
        )
        `,
        [`"${author}"`]
    )

    const isWordpressPage = (
        post: WordpressPageRecord | GdocRecord
    ): post is WordpressPageRecord =>
        (post as WordpressPageRecord).isWordpressPage === 1

    function* generateProperty(key: string, value: string) {
        yield `${key}: ${value}\n`
    }

    const sortByDateDesc = (
        a: GdocRecord | WordpressPageRecord,
        b: GdocRecord | WordpressPageRecord
    ): number => {
        if (!a.publishedAt || !b.publishedAt) return 0
        return (
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime()
        )
    }

    function* generateAllWorkArchieMl() {
        for (const post of [...gdocs, ...wpModularTopicPages].sort(
            sortByDateDesc
        )) {
            if (isWordpressPage(post)) {
                yield* generateProperty(
                    "url",
                    `https://ourworldindata.org/${post.slug}`
                )
                yield* generateProperty("title", post.title)
                yield* generateProperty("subtitle", post.subtitle)
                yield* generateProperty(
                    "authors",
                    JSON.parse(post.authors).join(", ")
                )
                const parsedPath = path.parse(post.thumbnail)
                yield* generateProperty(
                    "filename",
                    // /app/uploads/2021/09/reducing-fertilizer-768x301.png -> reducing-fertilizer.png
                    path.format({
                        name: parsedPath.name.replace(/-\d+x\d+$/, ""),
                        ext: parsedPath.ext,
                    })
                )
                yield "\n"
            } else {
                // this is a gdoc
                yield* generateProperty(
                    "url",
                    `https://docs.google.com/document/d/${post.id}/edit`
                )
                yield "\n"
            }
        }
    }

    res.type("text/plain")
    return [...generateAllWorkArchieMl()].join("")
}

export async function fetchNamespaces(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const rows = await db.knexRaw<{
        name: string
        description?: string
        isArchived: boolean
    }>(
        trx,
        `SELECT DISTINCT
            namespace AS name,
            namespaces.description AS description,
            namespaces.isArchived AS isArchived
        FROM active_datasets
        JOIN namespaces ON namespaces.name = active_datasets.namespace`
    )

    return {
        namespaces: lodash
            .sortBy(rows, (row) => row.description)
            .map((namespace) => ({
                ...namespace,
                isArchived: !!namespace.isArchived,
            })),
    }
}

export async function fetchSourceById(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const sourceId = expectInt(req.params.sourceId)

    const source = await db.knexRawFirst<Record<string, any>>(
        trx,
        `
        SELECT s.id, s.name, s.description, s.createdAt, s.updatedAt, d.namespace
        FROM sources AS s
        JOIN active_datasets AS d ON d.id=s.datasetId
        WHERE s.id=?`,
        [sourceId]
    )
    if (!source) throw new JsonError(`No source by id '${sourceId}'`, 404)
    source.variables = await db.knexRaw(
        trx,
        `SELECT id, name, updatedAt FROM variables WHERE variables.sourceId=?`,
        [sourceId]
    )

    return { source: source }
}
