// Get an ArchieML output of all the work produced by an author. This includes
// gdoc articles, gdoc modular/linear topic pages and wordpress modular topic
// pages. Data insights are excluded. This is used to manually populate the
// [.secondary] section of the {.research-and-writing} block of author pages

import { DbRawPostGdoc, JsonError } from "@ourworldindata/types"

import * as db from "../../db/db.js"
import * as lodash from "lodash"
import { expectInt } from "../../serverUtils/serverUtil.js"
import { Request } from "../authentication.js"
import e from "express"
// using the alternate template, which highlights topics rather than articles.
export async function fetchAllWork(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    type GdocRecord = Pick<DbRawPostGdoc, "id" | "publishedAt">

    const author = req.query.author
    const gdocs = await db
        .knexRaw<GdocRecord>(
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
        .then((rows) => lodash.orderBy(rows, (row) => row.publishedAt, "desc"))

    const archieLines = gdocs.map(
        (post) => `url: https://docs.google.com/document/d/${post.id}/edit`
    )

    res.type("text/plain")
    return archieLines.join("\n\n")
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
