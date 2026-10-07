/*
 * The document model of the gdocs writing reference: what `buildModel.ts`
 * produces from the committed registries, and what both renderers
 * (`renderMarkdown.ts` for --dry-run, `renderDocsRequests.ts` for the Google
 * Docs API) consume. It knows nothing about Markdown or Google Docs — tests
 * assert against this shape.
 */

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

/** One tab of the Google Doc (or one H1 chapter under --single-tab) */
export interface Section {
    title: string
    blocks: Block[]
}

export interface ReferenceDocument {
    sections: Section[]
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
