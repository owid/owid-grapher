import { type docs_v1 } from "@googleapis/docs"

// Migration definitions (RawBlockJson, GdocMigration, defineGdocMigration,
// transform types) live in db/gdocMigrations so that deploy-time db/migration
// wrappers can import them; re-exported here so the engine has one import
// point. The types below are engine-internal.
export * from "../../db/gdocMigrations/types.js"

/**
 * How a line of ArchieML text relates to the Google Doc it was parsed from.
 *
 * - "paragraph": a plain gdoc paragraph, 1:1 with the ArchieML line — patchable
 * - "synthetic": fabricated during conversion with no doc counterpart
 *   ([.list] wrappers and their blank prefix lines)
 * - "derived": produced from a doc element but not 1:1 line-patchable
 *   (heading expansions, bullet-prefixed list items, table scaffolding,
 *   horizontal rules)
 */
export type SourceLineKind = "paragraph" | "synthetic" | "derived"

export interface SourceRange {
    /** Google Docs character index of the first character */
    startIndex: number
    /** Exclusive end index; for paragraphs this includes the trailing newline */
    endIndex: number
}

export interface SourceRun {
    /** Plain text content of the text run, as it appears in the doc */
    content: string
    startIndex: number
    endIndex: number
}

export interface SourceLine {
    /** The ArchieML text of this line, exactly as gdocToArchie emits it */
    text: string
    kind: SourceLineKind
    /** The doc range of the element this line came from; null for synthetic lines */
    range: SourceRange | null
    /**
     * The plain textRuns making up this line, in order. Only populated for
     * kind "paragraph"; used to map offsets within the line to doc indexes.
     */
    runs: SourceRun[]
    /** The line contains a smart-chip link (richLink) — no doc text to patch */
    containsChip: boolean
    /** The line contains an inline object (e.g. a pasted image) */
    containsInlineObject: boolean
}

export type PatchFlagReason =
    | "block-open-or-close-line-not-patchable"
    | "chip-in-target-line"
    | "derived-or-synthetic-target-line"
    | "duplicate-frontmatter-key"
    | "key-token-not-locatable"
    | "multiline-value-not-supported"
    | "non-idempotent-transform"
    | "non-string-value-change"
    | "overlapping-edits"
    | "pending-suggestions-in-target"
    | "property-line-not-found"
    | "unbalanced-scopes"

export interface PatchFlag {
    reason: PatchFlagReason
    detail: string
}

export interface PatchResult {
    /**
     * batchUpdate requests, already ordered for sequential application
     * (descending document position). Empty when flags are present: a
     * flagged doc is never partially patched.
     */
    requests: docs_v1.Schema$Request[]
    flags: PatchFlag[]
}
