/*
 * The document model of the gdocs writing reference: what `buildModel.ts`
 * produces from the committed registries, and what both renderers
 * (`renderMarkdown.ts` for --dry-run, `renderDocsRequests.ts` for the Google
 * Docs API) consume. A library is one index document plus one document per
 * component, template and guide. It knows nothing about Markdown or Google Docs — tests
 * assert against this shape.
 */

import type { RelatedRef } from "@ourworldindata/types"

/** Heading depth; Google Docs named styles go HEADING_1 … HEADING_6, we stop at 4 */
export type HeadingLevel = 1 | 2 | 3 | 4

export const MAX_HEADING_LEVEL: HeadingLevel = 4

/** A span of inline text with its formatting */
export interface Run {
    text: string
    /** Monospace (Roboto Mono) */
    code?: boolean
    bold?: boolean
    italic?: boolean
    /** Absolute URL the run links to */
    link?: string
}

export interface HeadingBlock {
    type: "heading"
    level: HeadingLevel
    text: string
}

export interface ParagraphBlock {
    type: "paragraph"
    runs: Run[]
}

export interface BulletsBlock {
    type: "bullets"
    /** One entry per bullet; each is the runs of that bullet's text */
    items: Run[][]
}

export interface TableBlock {
    type: "table"
    /** Column titles, rendered bold */
    header: string[]
    /** rows → cells → runs; every row has `header.length` cells */
    rows: Run[][][]
}

/** A fenced example: monospace, fence markers dropped */
export interface CodeBlock {
    type: "code"
    text: string
}

export type Block =
    | HeadingBlock
    | ParagraphBlock
    | BulletsBlock
    | TableBlock
    | CodeBlock

/** The kinds of item that get a document of their own */
export type ReferenceItemKind = RelatedRef["kind"]

/** Every document in the library: the three item kinds plus the index */
export type ReferenceDocKind = ReferenceItemKind | "index"

/** Identifies one document of the library (the index is `{ kind: "index", id: "index" }`) */
export interface DocRef {
    kind: ReferenceDocKind
    id: string
}

export const INDEX_REF: DocRef = { kind: "index", id: "index" }

/** The URL of a library document, when it is known (never under --dry-run) */
export type UrlFor = (ref: DocRef) => string | undefined

/** One Google Doc: its Drive name and the blocks of its first tab */
export interface ReferenceDoc {
    docTitle: string
    blocks: Block[]
}

/** The document of one component, template or guide */
export interface ReferenceItemDoc extends ReferenceDoc {
    kind: ReferenceItemKind
    id: string
    /** The item's own title ("Chart"), as opposed to the Drive name */
    title: string
}

/** The whole library: one index plus one document per item */
export interface ReferenceLibrary {
    index: ReferenceDoc
    items: ReferenceItemDoc[]
}

export function heading(level: HeadingLevel, text: string): HeadingBlock {
    return { type: "heading", level, text }
}

export function paragraph(...runs: Run[]): ParagraphBlock {
    return { type: "paragraph", runs }
}

export function text(value: string): Run {
    return { text: value }
}

export function code(value: string): Run {
    return { text: value, code: true }
}

export function bold(value: string): Run {
    return { text: value, bold: true }
}

/** Clamps a heading depth to the deepest level we render */
export function clampHeadingLevel(level: number): HeadingLevel {
    return Math.max(1, Math.min(MAX_HEADING_LEVEL, level)) as HeadingLevel
}

/** The plain text of a run sequence, formatting dropped */
export function runsToPlainText(runs: Run[]): string {
    return runs.map((run) => run.text).join("")
}
