import { Request } from "express"
import {
    AgenticWritingContentType,
    DbPlainUser,
    JsonError,
} from "@ourworldindata/types"
import { HandlerResponse } from "../FunctionalRouter.js"
import * as db from "../../db/db.js"
import {
    listLineages,
    getHistory,
    recordDecision,
    recordRevision,
    recordReviewerEdit,
    createLineage,
    submitLineage,
    publishLineage,
    Decision,
    EditorialState,
} from "../agenticWritingStore.js"

// Admin API handlers for the "agentic-writing" playground. DB-backed; each
// handler receives a knex transaction from the route wrapper and the
// authenticated user from `res.locals.user`.

function currentUser(res: HandlerResponse): DbPlainUser {
    const user = res.locals.user as DbPlainUser | undefined
    if (!user)
        throw new JsonError(
            "no authenticated user — admin auth required",
            401
        )
    return user
}

function parseContentType(
    raw: unknown
): AgenticWritingContentType | undefined {
    if (raw === "data_nugget") return "data_nugget"
    return undefined
}

export async function getAgenticWritingSlugs(
    _req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const rows = await db.knexRaw<{ slug: string }>(
        trx,
        `-- sql
        SELECT DISTINCT jt.slug
        FROM agentic_writing_versions v
        JOIN agentic_writing_lineages l ON l.id = v.lineageId
        JOIN JSON_TABLE(
            v.payload,
            '$.grapherViews[*]' COLUMNS (slug VARCHAR(255) PATH '$.slug')
        ) jt ON jt.slug IS NOT NULL
        WHERE v.id = (
            SELECT MAX(id)
            FROM agentic_writing_versions
            WHERE lineageId = l.id
        )
        ORDER BY jt.slug ASC`
    )
    return { slugs: rows.map((r) => r.slug) }
}

export async function getAgenticWritingList(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const slug = typeof req.query.slug === "string" ? req.query.slug : undefined
    const status =
        typeof req.query.status === "string" ? req.query.status : undefined
    const editorialRaw =
        typeof req.query.editorial === "string"
            ? req.query.editorial
            : undefined
    const editorial =
        editorialRaw === "private" ||
        editorialRaw === "submitted" ||
        editorialRaw === "published"
            ? (editorialRaw as EditorialState)
            : undefined
    const contentType = parseContentType(req.query.contentType)

    let ownerUserId: number | undefined
    let ownerEmail: string | undefined
    const ownerRaw =
        typeof req.query.owner === "string" ? req.query.owner : undefined
    if (ownerRaw === "me") {
        ownerUserId = currentUser(res).id
    } else if (ownerRaw) {
        ownerEmail = ownerRaw
    }

    return listLineages(trx, {
        slug,
        status,
        editorial,
        ownerUserId,
        ownerEmail,
        contentType,
    })
}

export async function getAgenticWritingHistory(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    return getHistory(trx, req.params.lineageKey)
}

export async function postAgenticWritingDecision(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const body = req.body ?? {}
    const user = currentUser(res)
    return recordDecision(trx, req.params.lineageKey, {
        decision: body.decision as Decision,
        comment: body.comment ?? null,
        reviewedByUserId: user.id,
        reviewedByLabel: user.email,
        parentVersionId: body.parentVersionId,
    })
}

export async function postAgenticWritingRevision(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const body = req.body ?? {}
    const user = currentUser(res)
    return recordRevision(trx, req.params.lineageKey, {
        title: body.title,
        description: body.description,
        payload: body.payload,
        metadata: body.metadata,
        createdByUserId: user.id,
        createdByLabel: user.email,
        parentVersionId: body.parentVersionId,
    })
}

export async function postAgenticWritingEdit(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const body = req.body ?? {}
    const user = currentUser(res)
    return recordReviewerEdit(trx, req.params.lineageKey, {
        title: body.title,
        description: body.description,
        payload: body.payload,
        metadata: body.metadata,
        editedByUserId: user.id,
        editedByLabel: user.email,
        parentVersionId: body.parentVersionId,
        decision: (body.decision ?? null) as Decision | null,
        comment: body.comment ?? null,
    })
}

// Skills (and the admin "import" affordance) call this to push a freshly
// generated piece into the DB as a new lineage with its initial version.
// Idempotent on {sourceId, localId}. ContentType defaults to data_nugget.
export async function postAgenticWritingLineage(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const body = req.body ?? {}
    const user = currentUser(res)
    return createLineage(trx, {
        sourceId: body.sourceId,
        localId: body.localId,
        contentType: parseContentType(body.contentType),
        ownerUserId: user.id,
        ownerLabel: user.email,
        title: body.title,
        description: body.description,
        payload: body.payload,
        metadata: body.metadata,
        createdByLabel: body.createdByLabel ?? user.email,
        createdByUserId:
            body.createdByLabel && body.createdByLabel !== user.email
                ? null
                : user.id,
    })
}

export async function postAgenticWritingSubmit(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const user = currentUser(res)
    return submitLineage(trx, req.params.lineageKey, {
        submittedByUserId: user.id,
    })
}

export async function postAgenticWritingPublish(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const user = currentUser(res)
    return publishLineage(trx, req.params.lineageKey, {
        publishedByUserId: user.id,
    })
}
