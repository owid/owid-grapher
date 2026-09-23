import {
    ImageMetadata,
    LinkedChart,
    OwidEnrichedGdocBlock,
    OwidGdocAuthoringMode,
    OwidGdocContent,
    OwidGdocMinimalPostInterface,
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

export interface RichEditorSaveBodyRequest {
    body: OwidEnrichedGdocBlock[]
    /** The draft revision this save is based on; null if no draft existed */
    baseRevisionId: number | null
    kind?: Extract<PostGdocRevisionKind, "autosave" | "manual">
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
}

export interface RichEditorResolveReferencesRequest {
    grapherSlugs?: string[]
    explorerSlugs?: string[]
    filenames?: string[]
    gdocIds?: string[]
}

export interface RichEditorResolveReferencesResponse {
    linkedCharts: Record<string, LinkedChart>
    imageMetadata: Record<string, ImageMetadata>
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>
}
