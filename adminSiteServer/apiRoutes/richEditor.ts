import * as _ from "lodash-es"
import {
    ImageMetadata,
    JsonError,
    OwidEnrichedGdocBlock,
    OwidGdocAuthoringMode,
    OwidGdocContent,
    OwidGdocType,
    PostsGdocsDraftsTableName,
    PostsGdocsRevisionsTableName,
    PostsGdocsTableName,
    DbRawPostGdoc,
    DbRawPostGdocDraft,
    DbRawPostGdocRevision,
} from "@ourworldindata/types"
import { slugify } from "@ourworldindata/utils"
import { randomUUID } from "crypto"
import * as db from "../../db/db.js"
import {
    gdocFromJSON,
    updateDerivedGdocPostsComponents,
} from "../../db/model/Gdoc/GdocFactory.js"
import {
    getMinimalGdocPostsByIds,
    loadLinkedChartsForSlugs,
} from "../../db/model/Gdoc/GdocBase.js"
import { getImagesByFilenames } from "../../db/model/Image.js"
import {
    RichEditorCreateNativeGdocRequest,
    RichEditorGdocResponse,
    RichEditorResolveReferencesRequest,
    RichEditorResolveReferencesResponse,
    RichEditorRevisionResponse,
    RichEditorRevisionsResponse,
    RichEditorSaveBodyRequest,
    RichEditorSaveBodyResponse,
    RichEditorSaveConflictResponse,
} from "../../adminShared/RichEditorTypes.js"
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

/** Update posts_gdocs.content (+ markdown and derived tables) for a native doc. */
async function updateNativeGdocContent(
    trx: db.KnexReadWriteTransaction,
    row: DbRawPostGdoc,
    content: OwidGdocContent
): Promise<void> {
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
    userId: number,
    label?: string
): Promise<{ revisionId: number; updatedAt: Date }> {
    const [revisionId] = await trx
        .table(PostsGdocsRevisionsTableName)
        .insert({
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
    const { title, slug } = req.body as RichEditorCreateNativeGdocRequest
    if (!title) throw new JsonError("title is required", 400)

    const user = res.locals.user
    const id = `native-${randomUUID()}`
    const content: OwidGdocContent = {
        type: OwidGdocType.DataInsight,
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
        authoringMode:
            row.authoringMode ?? OwidGdocAuthoringMode.Gdocs,
        content,
        draftRevisionId: draft ? Number(draft.revisionId) : null,
        updatedAt: draft
            ? new Date(draft.updatedAt).toISOString()
            : row.updatedAt
              ? new Date(row.updatedAt).toISOString()
              : null,
    }
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
            updatedAt: draft
                ? new Date(draft.updatedAt).toISOString()
                : null,
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
    return { revisionId, updatedAt: updatedAt.toISOString() }
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
        throw new JsonError(
            `No revision ${revisionId} for document ${id}`,
            404
        )
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
        throw new JsonError(
            `No revision ${revisionId} for document ${id}`,
            404
        )

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
        throw new JsonError(
            `Document ${id} is already natively edited`,
            400
        )
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
    } = req.body as RichEditorResolveReferencesRequest

    const [linkedCharts, images, linkedDocuments] = await Promise.all([
        loadLinkedChartsForSlugs(trx, grapherSlugs, explorerSlugs),
        filenames.length ? getImagesByFilenames(trx, filenames) : [],
        gdocIds.length ? getMinimalGdocPostsByIds(trx, gdocIds) : [],
    ])

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
    }
}
