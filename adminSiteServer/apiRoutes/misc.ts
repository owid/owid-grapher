import {
    DbRawPostGdoc,
    JsonError,
    OwidGdocPostContent,
} from "@ourworldindata/types"

import * as db from "../../db/db.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import { Request } from "../authentication.js"
import { HandlerResponse } from "../FunctionalRouter.js"

// Get an ArchieML output of all the work produced by an author. Includes only
// gdoc articles and gdoc modular/linear topic pages — other gdoc types
// (data-insight, fragment, about-page, author, etc.) are excluded. Each entry
// is emitted as a :skip/:endskip ArchieML comment containing the gdoc title,
// followed by the gdoc edit url. This is used to manually populate the
// [.secondary] section of the {.research-and-writing} block of author pages
// using the alternate template, which highlights topics rather than articles.
export async function fetchAllWork(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    type GdocRecord = Pick<DbRawPostGdoc, "id" | "publishedAt"> &
        Pick<OwidGdocPostContent, "title">

    const author = req.query.author
    const gdocs = await db.knexRaw<GdocRecord>(
        trx,
        `-- sql
            SELECT id, content ->> '$.title' AS title
            FROM posts_gdocs
            WHERE JSON_CONTAINS(authors, ?)
            AND type IN ("article", "topic-page", "linear-topic-page")
            AND published = 1
            ORDER BY publishedAt DESC
    `,
        [`"${author}"`]
    )

    const archieLines = gdocs.map(
        (post) =>
            `:skip\n${post.title}\n:endskip\nurl: https://docs.google.com/document/d/${post.id}/edit`
    )

    res.type("text/plain")
    return archieLines.join("\n\n")
}

export async function fetchSourceById(
    req: Request,
    res: HandlerResponse,
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
