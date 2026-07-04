import {
    ImageMetadata,
    LinkedChart,
    NarrativeChartInfo,
    OwidEnrichedGdocBlock,
    OwidGdocAuthoringMode,
    OwidGdocContent,
    OwidGdocErrorMessage,
    OwidGdocMinimalPostInterface,
    PostGdocCommentAnchorType,
    PostGdocCommentThreadStatus,
    PostGdocRevisionKind,
} from "@ourworldindata/types"

// Request/response types for the rich editor API, shared between
// adminSiteServer and adminSiteClient.

export interface RichEditorGdocResponse {
    id: string
    slug: string
    published: boolean
    authoringMode: OwidGdocAuthoringMode
    /** Draft content if a draft exists, otherwise the live content */
    content: OwidGdocContent
    /** Revision the draft head points at; null if no draft exists yet */
    draftRevisionId: number | null
    updatedAt: string | null
}

export interface RichEditorCommentAnchorUpdate {
    threadId: number
    /** New ProseMirror positions in the saved draft doc; null if the anchor vanished */
    anchorFrom: number | null
    anchorTo: number | null
    anchorText: string | null
    orphaned: boolean
}

/** A block selected in the canvas, offered as a comment target */
export interface RichEditorSelectedBlock {
    blockId: string
    blockType: string
}

export interface RichEditorSaveBodyRequest {
    body: OwidEnrichedGdocBlock[]
    /** The draft revision this save is based on; null if no draft existed */
    baseRevisionId: number | null
    kind?: Extract<PostGdocRevisionKind, "autosave" | "manual">
    /** Updated comment anchor positions, mapped through the client's edits */
    commentAnchors?: RichEditorCommentAnchorUpdate[]
}

export interface RichEditorSaveBodyResponse {
    revisionId: number
    updatedAt: string
}

/** Returned with a 409 when the draft has moved on since baseRevisionId */
export interface RichEditorSaveConflictResponse {
    error: {
        message: string
        status: 409
    }
    currentRevisionId: number | null
    updatedAt: string | null
}

export interface RichEditorRevisionListItem {
    id: number
    kind: PostGdocRevisionKind
    label: string | null
    createdAt: string
    createdBy: number | null
    createdByFullName: string | null
}

export interface RichEditorRevisionsResponse {
    revisions: RichEditorRevisionListItem[]
}

export interface RichEditorRevisionResponse {
    id: number
    kind: PostGdocRevisionKind
    label: string | null
    createdAt: string
    content: OwidGdocContent
}

export interface RichEditorCreateNativeGdocRequest {
    title: string
    slug?: string
    /** data-insight (default) or article */
    type?: string
}

export interface RichEditorResolveReferencesRequest {
    grapherSlugs?: string[]
    explorerSlugs?: string[]
    filenames?: string[]
    gdocIds?: string[]
    narrativeChartNames?: string[]
}

/**
 * NarrativeChartInfo (the shared site attachment shape) plus the numeric id,
 * which the rich editor needs to open the narrative chart in the chart editor.
 */
export type RichEditorNarrativeChartInfo = NarrativeChartInfo & { id: number }

export interface RichEditorResolveReferencesResponse {
    linkedCharts: Record<string, LinkedChart>
    imageMetadata: Record<string, ImageMetadata>
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>
    narrativeCharts: Record<string, RichEditorNarrativeChartInfo>
}

// ── Publish ────────────────────────────────────────────────────────────────

export interface RichEditorPublishRequest {
    /** Concurrency check: the draft revision the author is looking at */
    baseRevisionId: number | null
}

export interface RichEditorPublishResponse {
    revisionId: number
    published: boolean
    publishedAt: string | null
    slug: string
}

/** Returned with a 400 when validation errors block publishing */
export interface RichEditorPublishValidationResponse {
    error: {
        message: string
        status: 400
    }
    validationErrors: OwidGdocErrorMessage[]
}

// ── Settings (non-body content fields + row fields) ───────────────────────

export interface RichEditorSaveSettingsRequest {
    /** Content fields to merge into the draft (body is not allowed here) */
    settings: Record<string, unknown>
    /** Row-level fields; only editable while the doc is unpublished */
    slug?: string
    baseRevisionId: number | null
}

// ── Comments ───────────────────────────────────────────────────────────────

export interface RichEditorComment {
    id: number
    threadId: number
    userId: number | null
    userFullName: string | null
    text: string
    createdAt: string
    updatedAt: string
}

export interface RichEditorCommentThread {
    id: number
    gdocId: string
    status: PostGdocCommentThreadStatus
    anchorType: PostGdocCommentAnchorType
    /** Rich-editor block id, set for block-anchored threads */
    anchorBlockId: string | null
    anchorFrom: number | null
    anchorTo: number | null
    anchorText: string | null
    createdAt: string
    createdBy: number | null
    createdByFullName: string | null
    resolvedAt: string | null
    comments: RichEditorComment[]
}

export interface RichEditorCommentThreadsResponse {
    threads: RichEditorCommentThread[]
}

export interface RichEditorCreateThreadRequest {
    anchorType: PostGdocCommentAnchorType
    /** Required for block threads: the target block's stable id */
    anchorBlockId?: string | null
    anchorFrom?: number | null
    anchorTo?: number | null
    anchorText?: string | null
    text: string
}

export interface RichEditorReplyRequest {
    text: string
}

export interface RichEditorUpdateThreadRequest {
    status: Extract<PostGdocCommentThreadStatus, "open" | "resolved">
}

// ── Presence ───────────────────────────────────────────────────────────────

export interface RichEditorPresenceEditor {
    userId: number
    fullName: string
    lastSeen: string
}

export interface RichEditorPresenceResponse {
    /** Other users with the editor open on this doc (excludes the requester) */
    editors: RichEditorPresenceEditor[]
}
