import {
    JsonError,
    AgenticWritingLineagesTableName,
    AgenticWritingVersionsTableName,
    UsersTableName,
    DbPlainAgenticWritingLineage,
    AgenticWritingContentType,
} from "@ourworldindata/types"
import * as db from "../db/db.js"

// DB-backed store for the "agentic-writing" playground: a generic pipeline for
// AI-authored content (the first type is data_nugget; more can be added).
//
// Schema:
//   agentic_writing_lineages   — one row per drafted piece (owner, contentType, editorial state)
//   agentic_writing_versions   — immutable, append-only version snapshots
//
// Each version carries a content-type-specific `payload` JSON in addition to
// the common `title` and `description`. For data_nugget the payload shape is
// `{ grapherViews: [{ slug, url, queryParams, caption }, ...] }`.

export type Decision = "approved" | "rejected" | "request_revisions"

export interface ReviewBlock {
    decision: Decision | null
    comment: string | null
    reviewedAt: string | null
    reviewedBy: string | null
}

export interface VersionRecord {
    $schemaVersion: 1
    lineageKey: string
    contentType: AgenticWritingContentType
    versionId: string
    parentVersionId: string | null
    createdAt: string
    createdBy: string
    kind: "initial" | "decision" | "revision"
    sourceId: string
    localId: string
    title: string
    description: string
    payload: Record<string, unknown>
    metadata: Record<string, unknown>
    review: ReviewBlock
}

export type LineageStatus =
    | "unreviewed"
    | "approved"
    | "rejected"
    | "awaiting_revision"
    | "awaiting_review"

export type EditorialState = "private" | "submitted" | "published"

export interface ListItem {
    lineageKey: string
    contentType: AgenticWritingContentType
    status: LineageStatus
    editorial: EditorialState
    ownerEmail: string
    ownerUserId: number
    versionCount: number
    latest: VersionRecord
}

// ---------------------------------------------------------------------------
// Internal: monotonic version ids
// ---------------------------------------------------------------------------

// Two writes inside the same millisecond (e.g. a revision immediately followed
// by a decision in recordReviewerEdit) must get distinct, strictly-increasing
// version ids. The DB UNIQUE(lineageId, versionId) is the backstop, but the
// monotonic counter keeps us from ever hitting it in practice.
let lastVersionMs = 0
function makeVersionId(): string {
    let ms = Date.now()
    if (ms <= lastVersionMs) ms = lastVersionMs + 1
    lastVersionMs = ms
    const now = new Date(ms)
    const pad = (n: number, w = 2) => n.toString().padStart(w, "0")
    const msPart = pad(now.getUTCMilliseconds(), 3)
    return (
        `v-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
        `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}-${msPart}Z`
    )
}

// ---------------------------------------------------------------------------
// Derived states
// ---------------------------------------------------------------------------

export function deriveStatus(latest: VersionRecord): LineageStatus {
    if (latest.review.decision === "approved") return "approved"
    if (latest.review.decision === "rejected") return "rejected"
    if (latest.review.decision === "request_revisions")
        return "awaiting_revision"
    if (latest.kind === "revision") return "awaiting_review"
    return "unreviewed"
}

export function deriveEditorial(
    lineage: Pick<
        DbPlainAgenticWritingLineage,
        "submittedAt" | "publishedAt"
    >
): EditorialState {
    if (lineage.publishedAt) return "published"
    if (lineage.submittedAt) return "submitted"
    return "private"
}

// ---------------------------------------------------------------------------
// Row → VersionRecord projection
// ---------------------------------------------------------------------------

interface VersionRowWithLineage {
    versionId: string
    parentVersionId: string | null
    createdAt: Date
    createdByLabel: string
    kind: VersionRecord["kind"]
    title: string
    description: string
    payload: string // JSON string (knex is configured with jsonStrings: true)
    metadata: string
    reviewDecision: Decision | null
    reviewComment: string | null
    reviewedAt: Date | null
    reviewedByLabel: string | null
    lineageKey: string
    contentType: AgenticWritingContentType
    sourceId: string
    localId: string
}

function toVersionRecord(row: VersionRowWithLineage): VersionRecord {
    return {
        $schemaVersion: 1,
        lineageKey: row.lineageKey,
        contentType: row.contentType,
        versionId: row.versionId,
        parentVersionId: row.parentVersionId,
        createdAt: row.createdAt.toISOString(),
        createdBy: row.createdByLabel,
        kind: row.kind,
        sourceId: row.sourceId,
        localId: row.localId,
        title: row.title,
        description: row.description,
        payload: JSON.parse(row.payload) as Record<string, unknown>,
        metadata: JSON.parse(row.metadata) as Record<string, unknown>,
        review: {
            decision: row.reviewDecision,
            comment: row.reviewComment,
            reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
            reviewedBy: row.reviewedByLabel,
        },
    }
}

const VERSION_SELECT_WITH_LINEAGE = `
    v.versionId,
    v.parentVersionId,
    v.createdAt,
    v.createdByLabel,
    v.kind,
    v.title,
    v.description,
    v.payload,
    v.metadata,
    v.reviewDecision,
    v.reviewComment,
    v.reviewedAt,
    v.reviewedByLabel,
    l.lineageKey,
    l.contentType,
    l.sourceId,
    l.localId
`

// ---------------------------------------------------------------------------
// Internal lookups
// ---------------------------------------------------------------------------

async function findLineageByKey(
    trx: db.KnexReadonlyTransaction,
    lineageKey: string
): Promise<DbPlainAgenticWritingLineage | undefined> {
    return trx
        .table(AgenticWritingLineagesTableName)
        .where({ lineageKey })
        .first()
}

async function requireLineage(
    trx: db.KnexReadonlyTransaction,
    lineageKey: string
): Promise<DbPlainAgenticWritingLineage> {
    const lineage = await findLineageByKey(trx, lineageKey)
    if (!lineage) throw new JsonError("lineage not found", 404)
    return lineage
}

async function readLatestVersion(
    trx: db.KnexReadonlyTransaction,
    lineageId: number
): Promise<VersionRecord | null> {
    const row = await db.knexRawFirst<VersionRowWithLineage>(
        trx,
        `-- sql
        SELECT ${VERSION_SELECT_WITH_LINEAGE}
        FROM ${AgenticWritingVersionsTableName} v
        JOIN ${AgenticWritingLineagesTableName} l ON l.id = v.lineageId
        WHERE v.lineageId = ?
        ORDER BY v.id DESC
        LIMIT 1`,
        [lineageId]
    )
    return row ? toVersionRecord(row) : null
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

export interface ListOpts {
    slug?: string
    status?: string
    editorial?: EditorialState
    ownerUserId?: number
    ownerEmail?: string
    contentType?: AgenticWritingContentType
}

interface ListRow extends VersionRowWithLineage {
    lineagePkId: number
    ownerUserId: number
    ownerEmail: string
    submittedAt: Date | null
    publishedAt: Date | null
    versionCount: number
}

export async function listLineages(
    trx: db.KnexReadonlyTransaction,
    opts: ListOpts
): Promise<{ totalReturned: number; items: ListItem[] }> {
    const wheres: string[] = []
    const params: unknown[] = []
    if (opts.editorial === "private") {
        wheres.push("l.submittedAt IS NULL")
    } else if (opts.editorial === "submitted") {
        wheres.push("l.submittedAt IS NOT NULL AND l.publishedAt IS NULL")
    } else if (opts.editorial === "published") {
        wheres.push("l.publishedAt IS NOT NULL")
    }
    if (opts.contentType) {
        wheres.push("l.contentType = ?")
        params.push(opts.contentType)
    }
    if (opts.ownerUserId != null) {
        wheres.push("l.ownerUserId = ?")
        params.push(opts.ownerUserId)
    } else if (opts.ownerEmail) {
        wheres.push("u.email = ?")
        params.push(opts.ownerEmail)
    }

    const whereSql = wheres.length ? `WHERE ${wheres.join(" AND ")}` : ""
    const rows = await db.knexRaw<ListRow>(
        trx,
        `-- sql
        SELECT
            ${VERSION_SELECT_WITH_LINEAGE},
            l.id AS lineagePkId,
            l.ownerUserId,
            u.email AS ownerEmail,
            l.submittedAt,
            l.publishedAt,
            vc.cnt AS versionCount
        FROM ${AgenticWritingLineagesTableName} l
        JOIN ${UsersTableName} u ON u.id = l.ownerUserId
        JOIN ${AgenticWritingVersionsTableName} v
            ON v.lineageId = l.id
            AND v.id = (
                SELECT MAX(id)
                FROM ${AgenticWritingVersionsTableName}
                WHERE lineageId = l.id
            )
        JOIN (
            SELECT lineageId, COUNT(*) AS cnt
            FROM ${AgenticWritingVersionsTableName}
            GROUP BY lineageId
        ) vc ON vc.lineageId = l.id
        ${whereSql}
        ORDER BY l.id ASC`,
        params
    )

    const items: ListItem[] = []
    for (const row of rows) {
        const latest = toVersionRecord(row)
        const reviewStatus = deriveStatus(latest)
        if (opts.status && reviewStatus !== opts.status) continue
        // Slug filter only applies to content types whose payload contains
        // chart slugs (data_nugget today). For other types it's a no-op.
        if (opts.slug) {
            const gvs = ((latest.payload as { grapherViews?: unknown[] })
                .grapherViews ?? []) as { slug?: string }[]
            if (!gvs.some((gv) => gv.slug === opts.slug)) continue
        }
        items.push({
            lineageKey: latest.lineageKey,
            contentType: latest.contentType,
            status: reviewStatus,
            editorial: deriveEditorial({
                submittedAt: row.submittedAt,
                publishedAt: row.publishedAt,
            }),
            ownerEmail: row.ownerEmail,
            ownerUserId: row.ownerUserId,
            versionCount: row.versionCount,
            latest,
        })
    }
    return { totalReturned: items.length, items }
}

export interface HistoryResult {
    lineageKey: string
    contentType: AgenticWritingContentType
    status: LineageStatus
    editorial: EditorialState
    ownerEmail: string
    ownerUserId: number
    versions: VersionRecord[]
}

export async function getHistory(
    trx: db.KnexReadonlyTransaction,
    lineageKey: string
): Promise<HistoryResult> {
    const lineage = await requireLineage(trx, lineageKey)
    const owner = await db.knexRawFirst<{ email: string }>(
        trx,
        `SELECT email FROM ${UsersTableName} WHERE id = ?`,
        [lineage.ownerUserId]
    )
    const rows = await db.knexRaw<VersionRowWithLineage>(
        trx,
        `-- sql
        SELECT ${VERSION_SELECT_WITH_LINEAGE}
        FROM ${AgenticWritingVersionsTableName} v
        JOIN ${AgenticWritingLineagesTableName} l ON l.id = v.lineageId
        WHERE v.lineageId = ?
        ORDER BY v.id ASC`,
        [lineage.id]
    )
    if (rows.length === 0)
        throw new JsonError("lineage has no versions", 500)
    const versions = rows.map(toVersionRecord)
    return {
        lineageKey,
        contentType: lineage.contentType,
        status: deriveStatus(versions[versions.length - 1]),
        editorial: deriveEditorial(lineage),
        ownerEmail: owner?.email ?? "",
        ownerUserId: lineage.ownerUserId,
        versions,
    }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface CreateLineageInput {
    sourceId: string
    localId: string
    contentType?: AgenticWritingContentType // defaults to data_nugget
    ownerUserId: number
    ownerLabel: string
    title: string
    description: string
    payload: Record<string, unknown>
    metadata?: Record<string, unknown>
    createdByLabel?: string
    createdByUserId?: number | null
}

export async function createLineage(
    trx: db.KnexReadWriteTransaction,
    input: CreateLineageInput
): Promise<{ ok: true; version: VersionRecord; alreadyExisted: boolean }> {
    if (!input.sourceId || !input.localId)
        throw new JsonError("sourceId and localId are required", 400)
    if (typeof input.title !== "string" || typeof input.description !== "string")
        throw new JsonError("title and description are required", 400)
    if (typeof input.payload !== "object" || input.payload === null)
        throw new JsonError("payload must be an object", 400)

    const lineageKey = `${input.sourceId}__${input.localId}`
    const existing = await findLineageByKey(trx, lineageKey)
    if (existing) {
        const latest = await readLatestVersion(trx, existing.id)
        if (!latest) throw new JsonError("lineage has no versions", 500)
        return { ok: true, version: latest, alreadyExisted: true }
    }

    const now = new Date()
    const insertedLineage = await trx
        .table(AgenticWritingLineagesTableName)
        .insert({
            lineageKey,
            contentType: input.contentType ?? "data_nugget",
            sourceId: input.sourceId,
            localId: input.localId,
            ownerUserId: input.ownerUserId,
            createdAt: now,
            updatedAt: now,
        })
    const lineageId = insertedLineage[0]

    const versionId = makeVersionId()
    await trx.table(AgenticWritingVersionsTableName).insert({
        lineageId,
        versionId,
        parentVersionId: null,
        createdAt: now,
        createdByUserId:
            input.createdByUserId === undefined
                ? input.ownerUserId
                : input.createdByUserId,
        createdByLabel: input.createdByLabel ?? input.ownerLabel,
        kind: "initial",
        title: input.title,
        description: input.description,
        payload: JSON.stringify(input.payload),
        metadata: JSON.stringify(input.metadata ?? {}),
        reviewDecision: null,
        reviewComment: null,
        reviewedAt: null,
        reviewedByUserId: null,
        reviewedByLabel: null,
    })
    const created = await readLatestVersion(trx, lineageId)
    if (!created) throw new JsonError("failed to read created version", 500)
    return { ok: true, version: created, alreadyExisted: false }
}

export interface RecordDecisionInput {
    decision: Decision
    comment?: string | null
    reviewedByUserId?: number | null
    reviewedByLabel?: string
    parentVersionId?: string
}

export async function recordDecision(
    trx: db.KnexReadWriteTransaction,
    lineageKey: string,
    input: RecordDecisionInput
): Promise<{ ok: true; version: VersionRecord }> {
    const { decision } = input
    if (
        decision !== "approved" &&
        decision !== "rejected" &&
        decision !== "request_revisions"
    ) {
        throw new JsonError(
            "decision must be approved, rejected, or request_revisions",
            400
        )
    }
    const comment = input.comment ?? null
    if (decision === "request_revisions" && !comment) {
        throw new JsonError(
            "comment is required when requesting revisions",
            400
        )
    }
    const reviewedByLabel = input.reviewedByLabel ?? "unknown"
    const lineage = await requireLineage(trx, lineageKey)
    const prior = await readLatestVersion(trx, lineage.id)
    if (!prior) throw new JsonError("lineage has no versions", 500)
    if (input.parentVersionId && input.parentVersionId !== prior.versionId) {
        throw new JsonError(
            `stale parentVersionId — latest is ${prior.versionId}`,
            409
        )
    }
    const now = new Date()
    const versionId = makeVersionId()
    await trx.table(AgenticWritingVersionsTableName).insert({
        lineageId: lineage.id,
        versionId,
        parentVersionId: prior.versionId,
        createdAt: now,
        createdByUserId: input.reviewedByUserId ?? null,
        createdByLabel: reviewedByLabel,
        kind: "decision",
        title: prior.title,
        description: prior.description,
        payload: JSON.stringify(prior.payload),
        metadata: JSON.stringify(prior.metadata),
        reviewDecision: decision,
        reviewComment: comment,
        reviewedAt: now,
        reviewedByUserId: input.reviewedByUserId ?? null,
        reviewedByLabel,
    })
    const created = await readLatestVersion(trx, lineage.id)
    if (!created) throw new JsonError("failed to read created version", 500)
    return { ok: true, version: created }
}

export interface RecordRevisionInput {
    title: string
    description: string
    payload: Record<string, unknown>
    metadata?: Record<string, unknown>
    createdByUserId?: number | null
    createdByLabel?: string
    parentVersionId?: string
}

export async function recordRevision(
    trx: db.KnexReadWriteTransaction,
    lineageKey: string,
    input: RecordRevisionInput
): Promise<{ ok: true; version: VersionRecord }> {
    if (
        typeof input.title !== "string" ||
        typeof input.description !== "string" ||
        typeof input.payload !== "object" ||
        input.payload === null
    ) {
        throw new JsonError(
            "title, description, and payload are required",
            400
        )
    }
    const lineage = await requireLineage(trx, lineageKey)
    const prior = await readLatestVersion(trx, lineage.id)
    if (!prior) throw new JsonError("lineage has no versions", 500)
    if (input.parentVersionId && input.parentVersionId !== prior.versionId) {
        throw new JsonError(
            `stale parentVersionId — latest is ${prior.versionId}`,
            409
        )
    }
    const now = new Date()
    const versionId = makeVersionId()
    await trx.table(AgenticWritingVersionsTableName).insert({
        lineageId: lineage.id,
        versionId,
        parentVersionId: prior.versionId,
        createdAt: now,
        createdByUserId: input.createdByUserId ?? null,
        createdByLabel: input.createdByLabel ?? "unknown",
        kind: "revision",
        title: input.title,
        description: input.description,
        payload: JSON.stringify(input.payload),
        metadata: JSON.stringify(input.metadata ?? prior.metadata),
        reviewDecision: null,
        reviewComment: null,
        reviewedAt: null,
        reviewedByUserId: null,
        reviewedByLabel: null,
    })
    const created = await readLatestVersion(trx, lineage.id)
    if (!created) throw new JsonError("failed to read created version", 500)
    return { ok: true, version: created }
}

export interface RecordReviewerEditInput {
    title: string
    description: string
    payload: Record<string, unknown>
    metadata?: Record<string, unknown>
    editedByUserId?: number | null
    editedByLabel?: string
    parentVersionId?: string
    decision?: Decision | null
    comment?: string | null
}

export async function recordReviewerEdit(
    trx: db.KnexReadWriteTransaction,
    lineageKey: string,
    input: RecordReviewerEditInput
): Promise<{ ok: true; version: VersionRecord }> {
    const decision = input.decision ?? null
    const comment = input.comment ?? null
    if (decision !== null) {
        if (
            decision !== "approved" &&
            decision !== "rejected" &&
            decision !== "request_revisions"
        ) {
            throw new JsonError(
                "decision must be approved, rejected, or request_revisions",
                400
            )
        }
        if (decision === "request_revisions" && !comment) {
            throw new JsonError(
                "comment is required when requesting revisions",
                400
            )
        }
    }
    const editedByLabel = input.editedByLabel ?? "unknown"
    const editedByUserId = input.editedByUserId ?? null

    const revision = await recordRevision(trx, lineageKey, {
        title: input.title,
        description: input.description,
        payload: input.payload,
        metadata: input.metadata,
        createdByUserId: editedByUserId,
        createdByLabel: editedByLabel,
        parentVersionId: input.parentVersionId,
    })
    if (decision === null) return revision

    return recordDecision(trx, lineageKey, {
        decision,
        comment,
        reviewedByUserId: editedByUserId,
        reviewedByLabel: editedByLabel,
        parentVersionId: revision.version.versionId,
    })
}

// ---------------------------------------------------------------------------
// Editorial transitions
// ---------------------------------------------------------------------------

export async function submitLineage(
    trx: db.KnexReadWriteTransaction,
    lineageKey: string,
    input: { submittedByUserId: number }
): Promise<{ ok: true; editorial: EditorialState }> {
    const lineage = await requireLineage(trx, lineageKey)
    if (lineage.publishedAt) {
        throw new JsonError("lineage is already published", 409)
    }
    if (lineage.submittedAt) {
        return { ok: true, editorial: "submitted" }
    }
    await trx
        .table(AgenticWritingLineagesTableName)
        .where("id", lineage.id)
        .update({
            submittedAt: new Date(),
            submittedByUserId: input.submittedByUserId,
        })
    return { ok: true, editorial: "submitted" }
}

export async function publishLineage(
    trx: db.KnexReadWriteTransaction,
    lineageKey: string,
    input: { publishedByUserId: number }
): Promise<{ ok: true; editorial: EditorialState }> {
    const lineage = await requireLineage(trx, lineageKey)
    if (lineage.publishedAt) {
        return { ok: true, editorial: "published" }
    }
    if (!lineage.submittedAt) {
        throw new JsonError(
            "lineage must be submitted before publishing",
            400
        )
    }
    const latest = await readLatestVersion(trx, lineage.id)
    if (!latest) throw new JsonError("lineage has no versions", 500)
    if (latest.review.decision !== "approved") {
        throw new JsonError(
            "lineage must be approved (latest review.decision === 'approved') before publishing",
            400
        )
    }
    await trx
        .table(AgenticWritingLineagesTableName)
        .where("id", lineage.id)
        .update({
            publishedAt: new Date(),
            publishedByUserId: input.publishedByUserId,
        })
    return { ok: true, editorial: "published" }
}
