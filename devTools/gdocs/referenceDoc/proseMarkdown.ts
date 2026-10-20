/*
 * Sidecar prose (Markdown) → the Markdown we upload to Drive.
 *
 * The prose is passed through as authored. Only two things change, and only
 * outside fenced examples:
 *
 * - headings are demoted below the section heading the prose sits under, so
 *   a sidecar's own `##` never breaks the document outline;
 * - mentions (`{.chart}`, `{guide:refs}`, `{template:article}`) resolve the
 *   way the admin's `parseMention` does: a component keeps its `{.id}` code
 *   form, a guide or template becomes its title. When the target's document
 *   URL is known (never under --dry-run), the mention links to it.
 *
 * Plain line-based string work on purpose: a Markdown tree round-trip would
 * reformat authored prose for nothing.
 */

import type { RelatedRef } from "@ourworldindata/types"
import { parseMention } from "../mentions.js"
import type { UrlFor } from "./model.js"

/** Resolves a guide/template mention to the title shown for it */
export type TitleFor = (ref: RelatedRef) => string | undefined

/** How mentions in prose are rendered: their title, and their link if known */
export interface MentionResolver {
    titleFor: TitleFor
    /** The document a mention links to; absent (or undefined) means no link */
    urlFor?: UrlFor
}

/** The deepest heading we emit (Google Docs styles go to HEADING_6) */
export const MAX_HEADING_LEVEL = 4

const BT = "`"
const FENCE = BT + BT + BT
const HEADING_LINE = /^( {0,3})(#{1,6}) /
// A single-backtick code span (not part of a longer backtick run)
const CODE_SPAN = /(?<!`)`([^`]+)`(?!`)/g

/**
 * A prose field under a heading of `baseLevel`: headings demoted, mentions
 * resolved, fenced blocks untouched.
 */
export function rewriteProse(
    markdown: string,
    baseLevel: number,
    mentions: MentionResolver
): string {
    return mapLinesOutsideFences(markdown, (line) =>
        rewriteMentions(demoteHeading(line, baseLevel), mentions)
    )
}

/**
 * One-line prose (a table cell, a bullet): mentions resolved and line breaks
 * turned into spaces.
 */
export function inlineProse(
    markdown: string,
    mentions: MentionResolver
): string {
    return rewriteMentions(markdown, mentions)
        .replace(/\s*\n\s*/g, " ")
        .trim()
}

/** A Markdown table cell: `|` escaped (also inside code spans), one line */
export function tableCell(markdown: string): string {
    // An already escaped `\|` stays as it is
    return markdown.replace(/(?<!\\)\|/g, "\\|").replace(/\s*\n\s*/g, " ")
}

/** `value` as a code span; a delimiter longer than any backtick run inside */
export function codeSpan(value: string): string {
    if (!value.includes(BT)) return BT + value + BT
    const longestRun = Math.max(
        ...(value.match(/`+/g) ?? []).map((run) => run.length)
    )
    const delimiter = BT.repeat(longestRun + 1)
    return delimiter + " " + value + " " + delimiter
}

/** `[text](url)` when the url is known, else just the text */
export function linkTo(text: string, url: string | undefined): string {
    return url ? `[${text}](${url})` : text
}

/** Clamps a heading depth to the levels we emit */
export function clampHeadingLevel(level: number): number {
    return Math.max(1, Math.min(MAX_HEADING_LEVEL, level))
}

export function headingLine(level: number, text: string): string {
    return `${"#".repeat(clampHeadingLevel(level))} ${text}`
}

/** True for a fence opener or closer, indented or not */
export function isFenceLine(line: string): boolean {
    return line.trimStart().startsWith(FENCE)
}

/** Applies `rewrite` to every line that is not inside (or delimiting) a fence */
function mapLinesOutsideFences(
    markdown: string,
    rewrite: (line: string) => string
): string {
    let inFence = false
    return markdown
        .split("\n")
        .map((line) => {
            if (isFenceLine(line)) {
                inFence = !inFence
                return line
            }
            return inFence ? line : rewrite(line)
        })
        .join("\n")
}

/**
 * A sidecar's own `##` is its top heading, so it lands one level below the
 * heading the prose is rendered under, `###` two below, never past H4. A
 * stray `#` counts as `##`: prose never outranks its own heading.
 */
function demoteHeading(line: string, baseLevel: number): string {
    const match = HEADING_LINE.exec(line)
    if (!match) return line
    const [prefix, indent, hashes] = match
    const depth = Math.max(hashes.length, 2)
    const level = clampHeadingLevel(baseLevel + depth - 1)
    return indent + "#".repeat(level) + " " + line.slice(prefix.length)
}

/** Rewrites every single-backtick span whose whole content is a mention */
function rewriteMentions(text: string, mentions: MentionResolver): string {
    return text.replace(CODE_SPAN, (span: string, content: string) => {
        const mention = parseMention(content)
        if (!mention) return span
        const url = mentions.urlFor?.(mention)
        const label =
            mention.kind === "component"
                ? span
                : (mentions.titleFor(mention) ?? mention.id)
        return linkTo(label, url)
    })
}
