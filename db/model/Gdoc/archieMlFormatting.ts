// Visual ArchieML formatting, ported from the `owid/gdocs-addon`
// (`dist/server/format.ts`): indented blocks, blue keys, brackets coloured by
// depth, red-on-yellow mismatched closers and small grey refs.
//
// Pure: it only decides styles. It never changes text, so it doesn't port the
// add-on's `key: ` spacing normalization or delimiter trimming.

/** A `[start, end)` range of offsets into a line's plain text. */
export type TextRange = [start: number, end: number]

export interface LineColors {
    foreground: string // hex, e.g. "#0094FF"
    background: string
}

export interface LineFormat {
    /** Nesting depth; the writer indents by `INDENT_STEP_PT` per level. */
    indentLevel: number
    /** Colours for the whole line (bracket lines only). */
    lineColors?: LineColors
    /** The `key:` part of a property line, colon included. */
    keyRange?: TextRange
    /** Parts of the line inside a `{ref}…{/ref}`, tags included. */
    refRanges: TextRange[]
}

export const INDENT_STEP_PT = 10
export const KEY_COLOR = "#0094FF"
export const REF_COLOR = "#535353"
export const REF_FONT_SIZE_PT = 8
const BRACKET_COLORS = ["#f47835", "#23974a", "#FF00FF"]
const BRACKET_BACKGROUND = "#FFFFFF"
export const MISMATCH_COLORS: LineColors = {
    foreground: "#FF0000",
    background: "#FFFF00",
}

const KEY_REGEX = /^(\s*)[a-zA-Z-]+\s*:/
const OBJECT_OPENER_REGEX = /^\s*\{[a-zA-Z+.-]+\}\s*$/
const ARRAY_OPENER_REGEX = /^\s*\[[a-zA-Z+.-]+\]\s*$/
const OBJECT_CLOSER_REGEX = /^\s*\{\}\s*$/
const ARRAY_CLOSER_REGEX = /^\s*\[\]\s*$/
// `{ref}` matches the object opener regex, but it is inline footnote syntax,
// not a block. Case-insensitive, like the ref regex below.
const REF_OPENER_REGEX = /^\s*\{ref\}\s*$/i
// Same as `extractRefs` in `archieToEnriched`: non-greedy, may span lines.
const REF_REGEX = /\{ref\}(.*?)\{\/ref\}/gis

// Same regexes as `stripIgnoredArchieml` in `archieToEnriched`.
const IGNORE_REGEX = /^[ \t\r]*:[ \t\r]*ignore\b.*$/im
const SKIP_BLOCK_REGEX =
    /(^[ \t\r]*:[ \t\r]*skip\b.*$)([\s\S]*?)(^[ \t\r]*:[ \t\r]*endskip\b.*$|$(?![\s\S]))/gim

type Bracket = "object" | "array"

function bracketColors(level: number): LineColors {
    return {
        foreground: BRACKET_COLORS[level % BRACKET_COLORS.length],
        background: BRACKET_BACKGROUND,
    }
}

/** Replaces every character but "\n" with a space, keeping the length. */
function mask(text: string): string {
    return text.replace(/[^\n]/g, " ")
}

/**
 * Blanks what the site discards (everything from `:ignore` on, the content of
 * `:skip` … `:endskip` blocks) without changing any offset, so refs found in
 * the result are only the ones the site keeps.
 */
function maskIgnoredArchieml(text: string): string {
    const ignore = text.match(IGNORE_REGEX)
    if (ignore?.index !== undefined)
        text = text.slice(0, ignore.index) + mask(text.slice(ignore.index))

    return text.replace(
        SKIP_BLOCK_REGEX,
        (_match, skip: string, content: string, endskip: string) =>
            skip + mask(content) + endskip
    )
}

/** Ref ranges per line, for refs that may span several lines. */
function findRefRanges(lines: string[]): TextRange[][] {
    const rangesPerLine: TextRange[][] = lines.map(() => [])

    // Offset of each line's first character in the joined text.
    const lineStarts: number[] = []
    let offset = 0
    for (const line of lines) {
        lineStarts.push(offset)
        offset += line.length + 1 // + "\n"
    }

    const text = maskIgnoredArchieml(lines.join("\n"))
    for (const match of text.matchAll(REF_REGEX)) {
        const refStart = match.index
        const refEnd = refStart + match[0].length
        // Clip the ref to each line it touches.
        lines.forEach((line, i) => {
            const start = Math.max(refStart, lineStarts[i]) - lineStarts[i]
            const end =
                Math.min(refEnd, lineStarts[i] + line.length) - lineStarts[i]
            if (start < end) rangesPerLine[i].push([start, end])
        })
    }
    return rangesPerLine
}

/**
 * The format of each line, given every line's plain text (inline tags like
 * `<b>` already removed). Runs over the whole doc, since a line's indent
 * depends on the brackets above it.
 */
export function formatArchieMlLines(lines: string[]): LineFormat[] {
    const refRangesPerLine = findRefRanges(lines)
    const openerStack: Bracket[] = []

    return lines.map((line, i) => {
        const format: LineFormat = {
            indentLevel: openerStack.length,
            refRanges: refRangesPerLine[i],
        }

        // A key line is never a bracket line.
        const key = line.match(KEY_REGEX)
        if (key) {
            format.keyRange = [key[1].length, key[0].length]
            return format
        }

        const isObjectOpener =
            OBJECT_OPENER_REGEX.test(line) && !REF_OPENER_REGEX.test(line)
        const isArrayOpener = ARRAY_OPENER_REGEX.test(line)
        const isObjectCloser = OBJECT_CLOSER_REGEX.test(line)
        const isArrayCloser = ARRAY_CLOSER_REGEX.test(line)

        if (isObjectOpener || isArrayOpener) {
            // Coloured at its own level; the lines after it are one deeper.
            format.lineColors = bracketColors(openerStack.length)
            openerStack.push(isObjectOpener ? "object" : "array")
        } else if (isObjectCloser || isArrayCloser) {
            // Back at the level it returns to. With no opener, stays at 0.
            const opener = openerStack.pop()
            format.indentLevel = openerStack.length
            const expected: Bracket = isObjectCloser ? "object" : "array"
            format.lineColors =
                opener === expected
                    ? bracketColors(openerStack.length)
                    : MISMATCH_COLORS
        }
        return format
    })
}
