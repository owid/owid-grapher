import * as _ from "lodash-es"
import {
    ImageMetadata,
    JsonError,
    OwidEnrichedGdocBlock,
    OwidGdocAuthoringMode,
    OwidGdocContent,
    OwidGdocErrorMessageType,
    OwidGdocType,
    PostsGdocsCommentThreadsTableName,
    PostsGdocsCommentsTableName,
    PostsGdocsDraftsTableName,
    PostsGdocsRevisionsTableName,
    PostsGdocsTableName,
    DbRawPostGdoc,
    DbRawPostGdocCommentThread,
    DbRawPostGdocDraft,
    DbRawPostGdocRevision,
} from "@ourworldindata/types"
import { slugify } from "@ourworldindata/utils"
import { randomUUID } from "crypto"
import * as db from "../../db/db.js"
import {
    GdocLinkUpdateMode,
    gdocFromJSON,
    getAndLoadGdocById,
    setImagesInContentGraph,
    setLinksForGdoc,
    updateDerivedGdocPostsComponents,
    upsertGdoc,
} from "../../db/model/Gdoc/GdocFactory.js"
import {
    indexAndBakeGdocIfNeccesary,
    validateSlugCollisionsIfPublishing,
} from "./gdocs.js"
import {
    getMinimalGdocPostsByIds,
    loadLinkedChartsForSlugs,
} from "../../db/model/Gdoc/GdocBase.js"
import { getImagesByFilenames } from "../../db/model/Image.js"
import { getNarrativeChartsInfo } from "../../db/model/NarrativeChart.js"
import {
    RichEditorCommentThread,
    RichEditorCommentThreadsResponse,
    RichEditorCreateNativeGdocRequest,
    RichEditorCreateThreadRequest,
    RichEditorGdocResponse,
    RichEditorPublishRequest,
    RichEditorPublishResponse,
    RichEditorPublishValidationResponse,
    RichEditorReplyRequest,
    RichEditorResolveReferencesRequest,
    RichEditorResolveReferencesResponse,
    RichEditorRevisionResponse,
    RichEditorRevisionsResponse,
    RichEditorSaveBodyRequest,
    RichEditorSaveBodyResponse,
    RichEditorSaveConflictResponse,
    RichEditorCommentAnchorUpdate,
    RichEditorSaveSettingsRequest,
    RichEditorUpdateThreadRequest,
} from "../../adminShared/RichEditorTypes.js"
import { stripBlockIds } from "../../adminShared/richEditor/serialization/serialization.js"
import { Request } from "../authentication.js"
import { HandlerResponse } from "../FunctionalRouter.js"

const MAX_AUTOSAVE_REVISIONS = 50

async function getGdocRowOrThrow(
    trx: db.KnexReadonlyTransaction,
    id: string
): Promise<DbRawPostGdoc> {
    const row = await trx
        .table(PostsGdocsTableName)
        .where({ id })
        .first<DbRawPostGdoc | undefined>()
    if (!row) throw new JsonError(`No document with id ${id} found`, 404)
    return row
}

function assertNativeAuthoringMode(row: DbRawPostGdoc): void {
    if (row.authoringMode !== OwidGdocAuthoringMode.Native) {
        throw new JsonError(
            `Document ${row.id} is authored in Google Docs; its body cannot be edited natively. Convert it to native editing first.`,
            400
        )
    }
}

function validateBodyBlocks(body: unknown): OwidEnrichedGdocBlock[] {
    if (!Array.isArray(body)) {
        throw new JsonError("body must be an array of enriched blocks", 400)
    }
    for (const block of body) {
        if (
            typeof block !== "object" ||
            block === null ||
            typeof (block as { type?: unknown }).type !== "string"
        ) {
            throw new JsonError(
                "every block must be an object with a string 'type'",
                400
            )
        }
    }
    return body as OwidEnrichedGdocBlock[]
}

/**
 * Editor-assigned block ids live only in drafts and revisions; whatever is
 * written to posts_gdocs.content (live/published content, consumed by the
 * baker, site, and search) is stripped of them.
 */
function withoutBlockIds(content: OwidGdocContent): OwidGdocContent {
    if (!content.body) return content
    return { ...content, body: stripBlockIds(content.body) }
}

/** Update posts_gdocs.content (+ markdown and derived tables) for a native doc. */
async function updateNativeGdocContent(
    trx: db.KnexReadWriteTransaction,
    row: DbRawPostGdoc,
    draftContent: OwidGdocContent
): Promise<void> {
    const content = withoutBlockIds(draftContent)
    const gdoc = gdocFromJSON({ ...row, content })
    gdoc.updateMarkdown()
    await trx
        .table(PostsGdocsTableName)
        .where({ id: row.id })
        .update({
            content: JSON.stringify(content),
            markdown: gdoc.markdown,
        })
    await updateDerivedGdocPostsComponents(trx, row.id, content.body)
}

async function insertRevisionAndUpdateDraft(
    trx: db.KnexReadWriteTransaction,
    row: DbRawPostGdoc,
    content: OwidGdocContent,
    kind: "autosave" | "manual" | "publish" | "restore",
    userId: number | null,
    label?: string
): Promise<{ revisionId: number; updatedAt: Date }> {
    const [revisionId] = await trx.table(PostsGdocsRevisionsTableName).insert({
        gdocId: row.id,
        content: JSON.stringify(content),
        kind,
        label: label ?? null,
        createdBy: userId,
    })

    await trx
        .table(PostsGdocsDraftsTableName)
        .insert({
            gdocId: row.id,
            content: JSON.stringify(content),
            revisionId,
            updatedBy: userId,
        })
        .onConflict("gdocId")
        .merge(["content", "revisionId", "updatedBy"])

    // Prune old autosaves (never revisions still referenced by a draft head)
    await db.knexRaw(
        trx,
        `-- sql
        DELETE FROM posts_gdocs_revisions
        WHERE gdocId = ?
            AND kind = 'autosave'
            AND id NOT IN (
                SELECT id FROM (
                    SELECT id FROM posts_gdocs_revisions
                    WHERE gdocId = ? AND kind = 'autosave'
                    ORDER BY id DESC
                    LIMIT ${MAX_AUTOSAVE_REVISIONS}
                ) recent
            )
            AND id NOT IN (
                SELECT revisionId FROM posts_gdocs_drafts WHERE gdocId = ?
            )`,
        [row.id, row.id, row.id]
    )

    // For unpublished docs the draft is the doc: keep posts_gdocs.content
    // (and its derived markdown/components) in sync. Published docs keep
    // their live content until the draft is explicitly published.
    if (!row.published) {
        await updateNativeGdocContent(trx, row, content)
    }

    return { revisionId, updatedAt: new Date() }
}

export async function createNativeGdoc(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
): Promise<RichEditorGdocResponse> {
    const { title, slug, type } = req.body as RichEditorCreateNativeGdocRequest
    if (!title) throw new JsonError("title is required", 400)
    const docType = (type ?? OwidGdocType.DataInsight) as OwidGdocType
    if (![OwidGdocType.DataInsight, OwidGdocType.Article].includes(docType)) {
        throw new JsonError(
            `Native creation is not supported for type ${type}`,
            400
        )
    }

    const user = res.locals.user
    const id = `native-${randomUUID()}`
    const content: OwidGdocContent = {
        type: docType,
        title,
        authors: [user.fullName],
        body: [],
    } as OwidGdocContent

    const gdoc = gdocFromJSON({ id, slug: slug || slugify(title), content })
    gdoc.updateMarkdown()

    await trx.table(PostsGdocsTableName).insert({
        id,
        slug: slug || slugify(title),
        content: JSON.stringify(content),
        published: 0,
        authoringMode: OwidGdocAuthoringMode.Native,
        markdown: gdoc.markdown,
    })

    const row = await getGdocRowOrThrow(trx, id)
    const { revisionId } = await insertRevisionAndUpdateDraft(
        trx,
        row,
        content,
        "manual",
        user.id,
        "Created"
    )

    return {
        id,
        slug: row.slug,
        published: false,
        authoringMode: OwidGdocAuthoringMode.Native,
        content,
        draftRevisionId: revisionId,
        updatedAt: new Date().toISOString(),
    }
}

export async function getGdocForEditor(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
): Promise<RichEditorGdocResponse> {
    const { id } = req.params
    const row = await getGdocRowOrThrow(trx, id)
    const draft = await trx
        .table(PostsGdocsDraftsTableName)
        .where({ gdocId: id })
        .first<DbRawPostGdocDraft | undefined>()

    const content: OwidGdocContent = draft
        ? JSON.parse(draft.content)
        : JSON.parse(row.content)

    res.set("Cache-Control", "no-store")
    return {
        id: row.id,
        slug: row.slug,
        published: !!row.published,
        authoringMode: row.authoringMode ?? OwidGdocAuthoringMode.Gdocs,
        content,
        draftRevisionId: draft ? Number(draft.revisionId) : null,
        updatedAt: draft
            ? new Date(draft.updatedAt).toISOString()
            : row.updatedAt
              ? new Date(row.updatedAt).toISOString()
              : null,
    }
}

/**
 * The materialization entry point for the sync server: write the body (as
 * derived from the live Yjs document) into the draft head + an autosave
 * revision. No optimistic-concurrency check — the ydoc is authoritative for
 * synced docs. Skips the write when the body is unchanged (e.g. the final
 * store on disconnect).
 */
export async function materializeNativeGdocBody(
    trx: db.KnexReadWriteTransaction,
    gdocId: string,
    body: OwidEnrichedGdocBlock[],
    userId: number | null
): Promise<{ revisionId: number } | { unchanged: true }> {
    const row = await getGdocRowOrThrow(trx, gdocId)
    assertNativeAuthoringMode(row)

    const draft = await trx
        .table(PostsGdocsDraftsTableName)
        .where({ gdocId })
        .first<DbRawPostGdocDraft | undefined>()
    const baseContent: OwidGdocContent = draft
        ? JSON.parse(draft.content)
        : JSON.parse(row.content)
    if (draft && JSON.stringify(baseContent.body) === JSON.stringify(body)) {
        return { unchanged: true }
    }

    const content: OwidGdocContent = { ...baseContent, body }
    const { revisionId } = await insertRevisionAndUpdateDraft(
        trx,
        row,
        content,
        "autosave",
        userId
    )
    return { revisionId }
}

export async function saveGdocBody(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
): Promise<RichEditorSaveBodyResponse | RichEditorSaveConflictResponse> {
    const { id } = req.params
    const {
        body,
        baseRevisionId,
        kind = "autosave",
        commentAnchors,
    } = req.body as RichEditorSaveBodyRequest

    const row = await getGdocRowOrThrow(trx, id)
    assertNativeAuthoringMode(row)
    const blocks = validateBodyBlocks(body)

    const draft = await trx
        .table(PostsGdocsDraftsTableName)
        .where({ gdocId: id })
        .first<DbRawPostGdocDraft | undefined>()

    const currentRevisionId = draft ? Number(draft.revisionId) : null
    if (currentRevisionId !== (baseRevisionId ?? null)) {
        res.status(409)
        const conflict: RichEditorSaveConflictResponse = {
            error: {
                message:
                    "The draft has been changed since you loaded it. Reload to get the newest version.",
                status: 409,
            },
            currentRevisionId,
            updatedAt: draft ? new Date(draft.updatedAt).toISOString() : null,
        }
        return conflict
    }

    const baseContent: OwidGdocContent = draft
        ? JSON.parse(draft.content)
        : JSON.parse(row.content)
    const content: OwidGdocContent = { ...baseContent, body: blocks }

    const { revisionId, updatedAt } = await insertRevisionAndUpdateDraft(
        trx,
        row,
        content,
        kind,
        res.locals.user.id
    )

    // The client maps comment anchors through its edits and reports the new
    // positions with every save; anchors that vanished become orphaned.
    await applyCommentAnchorUpdates(trx, id, commentAnchors ?? [])

    return { revisionId, updatedAt: updatedAt.toISOString() }
}

async function applyCommentAnchorUpdates(
    trx: db.KnexReadWriteTransaction,
    gdocId: string,
    commentAnchors: RichEditorCommentAnchorUpdate[]
): Promise<void> {
    for (const anchor of commentAnchors) {
        await trx
            .table(PostsGdocsCommentThreadsTableName)
            .where({ id: anchor.threadId, gdocId })
            .update({
                anchorFrom: anchor.anchorFrom,
                anchorTo: anchor.anchorTo,
                anchorText: anchor.anchorText,
            })
        if (anchor.orphaned) {
            await trx
                .table(PostsGdocsCommentThreadsTableName)
                .where({ id: anchor.threadId, gdocId, status: "open" })
                .update({ status: "orphaned" })
        } else {
            await trx
                .table(PostsGdocsCommentThreadsTableName)
                .where({ id: anchor.threadId, gdocId, status: "orphaned" })
                .update({ status: "open" })
        }
    }
}

/**
 * Standalone comment-anchor refresh for synced documents: with live
 * collaboration the body is persisted by the sync server, so the client
 * reports anchor positions through this endpoint instead of alongside a
 * body save.
 */
export async function updateGdocCommentAnchors(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
): Promise<{ success: true }> {
    const { id } = req.params
    const { commentAnchors } = req.body as {
        commentAnchors: RichEditorCommentAnchorUpdate[]
    }
    await getGdocRowOrThrow(trx, id)
    if (!Array.isArray(commentAnchors))
        throw new JsonError("commentAnchors must be an array", 400)
    await applyCommentAnchorUpdates(trx, id, commentAnchors)
    return { success: true }
}

export async function getGdocRevisions(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
): Promise<RichEditorRevisionsResponse> {
    const { id } = req.params
    await getGdocRowOrThrow(trx, id)
    const rows = await db.knexRaw<{
        id: number
        kind: string
        label: string | null
        createdAt: Date
        createdBy: number | null
        createdByFullName: string | null
    }>(
        trx,
        `-- sql
        SELECT r.id, r.kind, r.label, r.createdAt, r.createdBy, u.fullName AS createdByFullName
        FROM posts_gdocs_revisions r
        LEFT JOIN users u ON u.id = r.createdBy
        WHERE r.gdocId = ?
        ORDER BY r.id DESC
        LIMIT 100`,
        [id]
    )
    return {
        revisions: rows.map((r) => ({
            id: Number(r.id),
            kind: r.kind as RichEditorRevisionsResponse["revisions"][number]["kind"],
            label: r.label,
            createdAt: new Date(r.createdAt).toISOString(),
            createdBy: r.createdBy,
            createdByFullName: r.createdByFullName,
        })),
    }
}

export async function getGdocRevision(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
): Promise<RichEditorRevisionResponse> {
    const { id, revisionId } = req.params
    const row = await trx
        .table(PostsGdocsRevisionsTableName)
        .where({ gdocId: id, id: Number(revisionId) })
        .first<DbRawPostGdocRevision | undefined>()
    if (!row)
        throw new JsonError(`No revision ${revisionId} for document ${id}`, 404)
    return {
        id: Number(row.id),
        kind: row.kind,
        label: row.label,
        createdAt: new Date(row.createdAt).toISOString(),
        content: JSON.parse(row.content),
    }
}

export async function restoreGdocRevision(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
): Promise<RichEditorSaveBodyResponse> {
    const { id, revisionId } = req.params
    const row = await getGdocRowOrThrow(trx, id)
    assertNativeAuthoringMode(row)

    const revision = await trx
        .table(PostsGdocsRevisionsTableName)
        .where({ gdocId: id, id: Number(revisionId) })
        .first<DbRawPostGdocRevision | undefined>()
    if (!revision)
        throw new JsonError(`No revision ${revisionId} for document ${id}`, 404)

    const content: OwidGdocContent = JSON.parse(revision.content)
    const result = await insertRevisionAndUpdateDraft(
        trx,
        row,
        content,
        "restore",
        res.locals.user.id,
        `Restored revision ${revisionId}`
    )
    return {
        revisionId: result.revisionId,
        updatedAt: result.updatedAt.toISOString(),
    }
}

export async function convertGdocToNative(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
): Promise<RichEditorGdocResponse> {
    const { id } = req.params
    const row = await getGdocRowOrThrow(trx, id)
    if (row.authoringMode === OwidGdocAuthoringMode.Native) {
        throw new JsonError(`Document ${id} is already natively edited`, 400)
    }

    await trx
        .table(PostsGdocsTableName)
        .where({ id })
        .update({ authoringMode: OwidGdocAuthoringMode.Native })
    const updatedRow = { ...row, authoringMode: OwidGdocAuthoringMode.Native }

    const content: OwidGdocContent = JSON.parse(row.content)
    const { revisionId } = await insertRevisionAndUpdateDraft(
        trx,
        updatedRow,
        content,
        "manual",
        res.locals.user.id,
        "Converted to native editing"
    )

    return {
        id: row.id,
        slug: row.slug,
        published: !!row.published,
        authoringMode: OwidGdocAuthoringMode.Native,
        content,
        draftRevisionId: revisionId,
        updatedAt: new Date().toISOString(),
    }
}

async function getDraftOrThrow(
    trx: db.KnexReadonlyTransaction,
    id: string
): Promise<DbRawPostGdocDraft> {
    const draft = await trx
        .table(PostsGdocsDraftsTableName)
        .where({ gdocId: id })
        .first<DbRawPostGdocDraft | undefined>()
    if (!draft)
        throw new JsonError(`Document ${id} has no draft to work with`, 400)
    return draft
}

function makeConflictResponse(
    res: HandlerResponse,
    draft: DbRawPostGdocDraft
): RichEditorSaveConflictResponse {
    res.status(409)
    return {
        error: {
            message:
                "The draft has been changed since you loaded it. Reload to get the newest version.",
            status: 409,
        },
        currentRevisionId: Number(draft.revisionId),
        updatedAt: new Date(draft.updatedAt).toISOString(),
    }
}

/**
 * Promotes the draft to the live content (posts_gdocs.content) and publishes
 * the doc, reusing the same machinery as the gdocs settings save: links,
 * image graph, derived tables, Algolia indexing, and bake/lightning deploy.
 */
export async function publishNativeGdoc(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
): Promise<
    | RichEditorPublishResponse
    | RichEditorSaveConflictResponse
    | RichEditorPublishValidationResponse
> {
    const { id } = req.params
    const { baseRevisionId } = req.body as RichEditorPublishRequest

    const row = await getGdocRowOrThrow(trx, id)
    assertNativeAuthoringMode(row)
    if (!row.slug) throw new JsonError("Set a slug before publishing", 400)

    const draft = await getDraftOrThrow(trx, id)
    if (Number(draft.revisionId) !== (baseRevisionId ?? null)) {
        return makeConflictResponse(res, draft)
    }

    const draftContent: OwidGdocContent = JSON.parse(draft.content)
    // published content is stripped of block ids; the draft (and the publish
    // revision, which stays in the draft lineage) keeps them so block-anchored
    // comments survive publishing and restores
    const content = withoutBlockIds(draftContent)

    const prevGdoc = await getAndLoadGdocById(trx, id)
    const prevJson = prevGdoc.toJSON()
    const publishedAt = prevJson.publishedAt
        ? new Date(prevJson.publishedAt)
        : new Date()
    publishedAt.setSeconds(0, 0)

    const nextGdoc = gdocFromJSON({
        ...prevJson,
        content,
        published: true,
        publishedAt,
    })
    await nextGdoc.loadState(trx)

    const validationErrors = nextGdoc.errors.filter(
        (error) => error.type === OwidGdocErrorMessageType.Error
    )
    if (validationErrors.length > 0) {
        res.status(400)
        return {
            error: {
                message:
                    "The document has validation errors that block publishing",
                status: 400,
            },
            validationErrors,
        }
    }

    await validateSlugCollisionsIfPublishing(trx, nextGdoc)
    await setImagesInContentGraph(trx, nextGdoc)
    await setLinksForGdoc(
        trx,
        nextGdoc.id,
        nextGdoc.links,
        GdocLinkUpdateMode.DeleteAndInsert
    )
    await upsertGdoc(trx, nextGdoc)

    // Record an immutable publish revision. The row is already published at
    // this point, so this does not overwrite the live content again.
    const { revisionId } = await insertRevisionAndUpdateDraft(
        trx,
        { ...row, published: 1 },
        draftContent,
        "publish",
        res.locals.user.id,
        "Published"
    )

    await indexAndBakeGdocIfNeccesary(trx, res.locals.user, prevGdoc, nextGdoc)

    return {
        revisionId,
        published: true,
        publishedAt: publishedAt.toISOString(),
        slug: nextGdoc.slug,
    }
}

export async function unpublishNativeGdoc(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
): Promise<RichEditorPublishResponse> {
    const { id } = req.params
    const row = await getGdocRowOrThrow(trx, id)
    assertNativeAuthoringMode(row)
    if (!row.published)
        throw new JsonError(`Document ${id} is not published`, 400)

    const prevGdoc = await getAndLoadGdocById(trx, id)
    const nextGdoc = gdocFromJSON({
        ...prevGdoc.toJSON(),
        published: false,
        publishedAt: null,
    })
    await nextGdoc.loadState(trx)

    await setLinksForGdoc(
        trx,
        nextGdoc.id,
        nextGdoc.links,
        GdocLinkUpdateMode.DeleteOnly
    )
    await upsertGdoc(trx, nextGdoc)
    await indexAndBakeGdocIfNeccesary(trx, res.locals.user, prevGdoc, nextGdoc)

    const draft = await trx
        .table(PostsGdocsDraftsTableName)
        .where({ gdocId: id })
        .first<DbRawPostGdocDraft | undefined>()

    return {
        revisionId: draft ? Number(draft.revisionId) : 0,
        published: false,
        publishedAt: null,
        slug: row.slug,
    }
}

/**
 * Saves non-body content fields (title, authors, grapher-url, …) into the
 * draft, going through the same revision mechanics as body saves. Row-level
 * fields (slug) are only editable while the doc is unpublished.
 */
export async function saveGdocEditorSettings(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
): Promise<RichEditorSaveBodyResponse | RichEditorSaveConflictResponse> {
    const { id } = req.params
    const { settings, slug, baseRevisionId, force } =
        req.body as RichEditorSaveSettingsRequest

    if (!settings || typeof settings !== "object")
        throw new JsonError("settings must be an object", 400)
    if ("body" in settings)
        throw new JsonError(
            "body cannot be changed via the settings endpoint",
            400
        )
    if ("type" in settings)
        throw new JsonError("the document type cannot be changed", 400)

    let row = await getGdocRowOrThrow(trx, id)
    assertNativeAuthoringMode(row)

    const draft = await getDraftOrThrow(trx, id)
    // With live collaboration the sync server bumps the draft head with
    // every materialization, so clients cannot hold a current baseRevisionId;
    // they send force instead. Settings fields are last-write-wins there —
    // the body is never touched by this endpoint, so nothing can clobber it.
    if (!force && Number(draft.revisionId) !== (baseRevisionId ?? null)) {
        return makeConflictResponse(res, draft)
    }

    if (slug !== undefined && slug !== row.slug) {
        if (row.published)
            throw new JsonError(
                "The slug of a published document cannot be changed here",
                400
            )
        await trx.table(PostsGdocsTableName).where({ id }).update({ slug })
        row = { ...row, slug }
    }

    const content: OwidGdocContent = JSON.parse(draft.content)
    const mutableContent = content as unknown as Record<string, unknown>
    for (const [key, value] of Object.entries(settings)) {
        if (value === null || value === undefined) {
            delete mutableContent[key]
        } else {
            mutableContent[key] = value
        }
    }

    const { revisionId, updatedAt } = await insertRevisionAndUpdateDraft(
        trx,
        row,
        content,
        "manual",
        res.locals.user.id,
        "Settings"
    )
    return { revisionId, updatedAt: updatedAt.toISOString() }
}

// ── Comments ───────────────────────────────────────────────────────────────

async function queryCommentThreads(
    trx: db.KnexReadonlyTransaction,
    gdocId: string,
    threadId?: number
): Promise<RichEditorCommentThread[]> {
    const threadRows = await db.knexRaw<
        DbRawPostGdocCommentThread & { createdByFullName: string | null }
    >(
        trx,
        `-- sql
        SELECT t.*, u.fullName AS createdByFullName
        FROM posts_gdocs_comment_threads t
        LEFT JOIN users u ON u.id = t.createdBy
        WHERE t.gdocId = ? ${threadId ? "AND t.id = ?" : ""}
        ORDER BY t.createdAt ASC`,
        threadId ? [gdocId, threadId] : [gdocId]
    )
    if (threadRows.length === 0) return []

    const commentRows = await db.knexRaw<{
        id: number
        threadId: number
        userId: number | null
        userFullName: string | null
        text: string
        createdAt: Date
        updatedAt: Date
    }>(
        trx,
        `-- sql
        SELECT c.id, c.threadId, c.userId, u.fullName AS userFullName,
            c.text, c.createdAt, c.updatedAt
        FROM posts_gdocs_comments c
        LEFT JOIN users u ON u.id = c.userId
        WHERE c.threadId IN (${threadRows.map(() => "?").join(", ")})
        ORDER BY c.createdAt ASC`,
        threadRows.map((thread) => thread.id)
    )
    const commentsByThread = _.groupBy(commentRows, "threadId")

    return threadRows.map((thread) => ({
        id: Number(thread.id),
        gdocId: thread.gdocId,
        status: thread.status,
        anchorType: thread.anchorType,
        anchorBlockId: thread.anchorBlockId,
        anchorFrom: thread.anchorFrom,
        anchorTo: thread.anchorTo,
        anchorText: thread.anchorText,
        createdAt: new Date(thread.createdAt).toISOString(),
        createdBy: thread.createdBy,
        createdByFullName: thread.createdByFullName,
        resolvedAt: thread.resolvedAt
            ? new Date(thread.resolvedAt).toISOString()
            : null,
        comments: (commentsByThread[thread.id] ?? []).map((comment) => ({
            id: Number(comment.id),
            threadId: Number(comment.threadId),
            userId: comment.userId,
            userFullName: comment.userFullName,
            text: comment.text,
            createdAt: new Date(comment.createdAt).toISOString(),
            updatedAt: new Date(comment.updatedAt).toISOString(),
        })),
    }))
}

export async function getGdocCommentThreads(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
): Promise<RichEditorCommentThreadsResponse> {
    const { id } = req.params
    await getGdocRowOrThrow(trx, id)
    return { threads: await queryCommentThreads(trx, id) }
}

export async function createGdocCommentThread(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
): Promise<RichEditorCommentThread> {
    const { id } = req.params
    const {
        anchorType,
        anchorBlockId = null,
        anchorFrom = null,
        anchorTo = null,
        anchorText = null,
        text,
    } = req.body as RichEditorCreateThreadRequest

    if (!text?.trim()) throw new JsonError("Comment text is required", 400)
    if (!["range", "block", "document"].includes(anchorType))
        throw new JsonError(`Invalid anchorType ${anchorType}`, 400)
    if (anchorType === "block" && !anchorBlockId)
        throw new JsonError("Block threads require an anchorBlockId", 400)
    await getGdocRowOrThrow(trx, id)

    const [threadId] = await trx
        .table(PostsGdocsCommentThreadsTableName)
        .insert({
            gdocId: id,
            anchorType,
            anchorBlockId: anchorType === "block" ? anchorBlockId : null,
            anchorFrom,
            anchorTo,
            anchorText,
            createdBy: res.locals.user.id,
        })
    await trx.table(PostsGdocsCommentsTableName).insert({
        threadId,
        userId: res.locals.user.id,
        text: text.trim(),
    })

    const [thread] = await queryCommentThreads(trx, id, threadId)
    return thread
}

export async function replyToGdocCommentThread(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
): Promise<RichEditorCommentThread> {
    const { id, threadId } = req.params
    const { text } = req.body as RichEditorReplyRequest
    if (!text?.trim()) throw new JsonError("Comment text is required", 400)

    const thread = await trx
        .table(PostsGdocsCommentThreadsTableName)
        .where({ id: Number(threadId), gdocId: id })
        .first<DbRawPostGdocCommentThread | undefined>()
    if (!thread)
        throw new JsonError(`No thread ${threadId} on document ${id}`, 404)

    await trx.table(PostsGdocsCommentsTableName).insert({
        threadId: Number(threadId),
        userId: res.locals.user.id,
        text: text.trim(),
    })

    const [updated] = await queryCommentThreads(trx, id, Number(threadId))
    return updated
}

export async function updateGdocCommentThread(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
): Promise<RichEditorCommentThread> {
    const { id, threadId } = req.params
    const { status } = req.body as RichEditorUpdateThreadRequest
    if (!["open", "resolved"].includes(status))
        throw new JsonError(`Invalid status ${status}`, 400)

    const thread = await trx
        .table(PostsGdocsCommentThreadsTableName)
        .where({ id: Number(threadId), gdocId: id })
        .first<DbRawPostGdocCommentThread | undefined>()
    if (!thread)
        throw new JsonError(`No thread ${threadId} on document ${id}`, 404)

    await trx
        .table(PostsGdocsCommentThreadsTableName)
        .where({ id: Number(threadId) })
        .update(
            status === "resolved"
                ? {
                      status,
                      resolvedAt: new Date(),
                      resolvedBy: res.locals.user.id,
                  }
                : { status, resolvedAt: null, resolvedBy: null }
        )

    const [updated] = await queryCommentThreads(trx, id, Number(threadId))
    return updated
}

// (Presence lives in the sync connection's awareness states now — see
// richEditorSync.ts and the client's useAwarenessPeers. The old in-memory
// heartbeat presence, which was per-process and reset on restart, is gone.)

export async function resolveEditorReferences(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
): Promise<RichEditorResolveReferencesResponse> {
    const {
        grapherSlugs = [],
        explorerSlugs = [],
        filenames = [],
        gdocIds = [],
        narrativeChartNames = [],
    } = req.body as RichEditorResolveReferencesRequest

    const [linkedCharts, images, linkedDocuments, narrativeCharts, ncIdRows] =
        await Promise.all([
            loadLinkedChartsForSlugs(trx, grapherSlugs, explorerSlugs),
            filenames.length ? getImagesByFilenames(trx, filenames) : [],
            gdocIds.length ? getMinimalGdocPostsByIds(trx, gdocIds) : [],
            getNarrativeChartsInfo(trx, narrativeChartNames),
            narrativeChartNames.length
                ? db.knexRaw<{ id: number; name: string }>(
                      trx,
                      `SELECT id, name FROM narrative_charts WHERE name IN (?)`,
                      [narrativeChartNames]
                  )
                : [],
        ])

    const narrativeChartIdsByName = new Map(
        ncIdRows.map((row) => [row.name, row.id])
    )

    const imageMetadata: Record<string, ImageMetadata> = {}
    for (const image of images) {
        imageMetadata[image.filename] = _.pick(image, [
            "defaultAlt",
            "filename",
            "cloudflareId",
            "originalHeight",
            "originalWidth",
            "updatedAt",
        ]) as ImageMetadata
    }

    return {
        linkedCharts: _.keyBy(linkedCharts, "originalSlug"),
        imageMetadata,
        linkedDocuments: _.keyBy(linkedDocuments, "id"),
        narrativeCharts: _.keyBy(
            narrativeCharts.map((nc) => ({
                ...nc,
                id: narrativeChartIdsByName.get(nc.name) ?? 0,
            })),
            "name"
        ),
    }
}
