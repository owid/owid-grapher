import { SourceLine } from "../types.js"

export interface PropertyLine {
    key: string
    lineIndex: number
    /**
     * Index of the last line of this property's value: equal to lineIndex
     * for single-line values, the index of the ":end" line for multiline ones
     */
    extentEndLineIndex: number
    multiline: boolean
    /** Offset of the key's first character within the line's raw doc text */
    keyOffsetInRaw: number | null
    /** Offset of the character immediately after the ":" within raw doc text */
    colonEndOffsetInRaw: number | null
}

export interface BlockMatch {
    type: string
    openLineIndex: number
    closeLineIndex: number
    /** Direct-child properties only — nothing inside nested blocks/arrays */
    properties: PropertyLine[]
}

export interface ScanImbalance {
    lineIndex: number
    detail: string
}

export interface ScanResult {
    /** Every {.type} block in the doc, in document order, at any nesting depth */
    blocks: BlockMatch[]
    /** Top-level key: value lines outside any scope */
    frontmatter: PropertyLine[]
    /** Scope open/close markers that didn't pair up cleanly, with locations */
    imbalances: ScanImbalance[]
}

// ArchieML tolerates whitespace inside tag braces ("{ .sticky-right }" is
// common in real docs), so all tag patterns must too
const BLOCK_OPEN = /^\{\s*[.+]+\s*([A-Za-z0-9-_]+)\s*\}$/
const BLOCK_CLOSE = /^\{\s*\}$/
const ARRAY_OPEN = /^\[\s*[.+]+\s*([A-Za-z0-9-_.]+)\s*\]$/
const ARRAY_CLOSE = /^\[\s*\]$/
const END_MARKER = /^:end$/i
const IGNORE_MARKER = /^:ignore$/i
const SKIP_MARKER = /^:skip$/i
const ENDSKIP_MARKER = /^:endskip$/i
const KEY_LINE = /^([A-Za-z0-9-_.]+)[ \t]*:/
const RAW_KEY_LINE = /^([ \t]*)([A-Za-z0-9-_.]+)[ \t]*:[ ]?/

/**
 * The formatting tags gdocToArchie emits for styled doc text. Anything else
 * (e.g. <div> inside a multiline html value) is literal typed content and
 * must NOT be treated as styling.
 */
const FORMATTING_MARKUP = /<\/?(?:b|i|u|s|q|a|br|sub|sup)(?:\s[^>]*)?>/gi
const INVISIBLE_CHARS =
    /(?:\u200B|\u200C|\u200D|\u200E|\u200F|\u2060|\uFEFF|\u00AD)/g

/**
 * Normalizes a line for structural matching. Authors routinely leave
 * formatting or invisible characters on tag lines (a bolded "{}", a
 * zero-width space) — the doc's underlying plain text, which the patcher
 * computes edit offsets from, never contains the markup, so recognizing the
 * intended structure here is safe.
 */
export function structuralLineText(text: string): string {
    return text
        .replace(FORMATTING_MARKUP, "")
        .replace(INVISIBLE_CHARS, "")
        .trim()
}

type Scope =
    | {
          kind: "block"
          type: string
          openLineIndex: number
          properties: PropertyLine[]
      }
    | { kind: "array"; name: string }

/**
 * Tracks ArchieML scope over source-mapped lines and yields every component
 * block with its direct properties, plus top-level frontmatter properties.
 *
 * This is a structural scanner, not a full ArchieML parser: it understands
 * exactly enough (block/array tags, key lines, :end multiline markers) to
 * locate edit targets. The engine independently validates every planned edit
 * by simulating it and re-parsing, so a mis-scan surfaces as a flagged doc,
 * never as a wrong write.
 */
export function scanScopes(lines: SourceLine[]): ScanResult {
    const blocks: BlockMatch[] = []
    const frontmatter: PropertyLine[] = []
    const stack: Scope[] = []
    const imbalances: ScanImbalance[] = []
    // The property a subsequent ":end" would attach to. Reset on any scope
    // change, mirroring how ArchieML flushes its buffer.
    let pendingProperty: PropertyLine | null = null
    let skipping = false

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex]
        const text = structuralLineText(line.text)
        const top = stack[stack.length - 1]

        // Mirror stripIgnoredArchieml: the parser never sees content after
        // :ignore or inside :skip…:endskip, so neither should the scanner
        if (IGNORE_MARKER.test(text)) break
        if (SKIP_MARKER.test(text)) {
            skipping = true
            pendingProperty = null
            continue
        }
        if (ENDSKIP_MARKER.test(text)) {
            skipping = false
            continue
        }
        if (skipping) continue

        const blockOpen = text.match(BLOCK_OPEN)
        if (blockOpen) {
            stack.push({
                kind: "block",
                type: blockOpen[1],
                openLineIndex: lineIndex,
                properties: [],
            })
            pendingProperty = null
            continue
        }

        if (BLOCK_CLOSE.test(text)) {
            if (top?.kind === "block") {
                stack.pop()
                blocks.push({
                    type: top.type,
                    openLineIndex: top.openLineIndex,
                    closeLineIndex: lineIndex,
                    properties: top.properties,
                })
            } else {
                imbalances.push({
                    lineIndex,
                    detail: `"{}" at line ${lineIndex} has no open block to close (enclosing scope: ${describeScope(top)})`,
                })
            }
            pendingProperty = null
            continue
        }

        const arrayOpen = text.match(ARRAY_OPEN)
        if (arrayOpen) {
            stack.push({ kind: "array", name: arrayOpen[1] })
            pendingProperty = null
            continue
        }

        if (ARRAY_CLOSE.test(text)) {
            if (top?.kind === "array") {
                stack.pop()
            } else {
                imbalances.push({
                    lineIndex,
                    detail: `"[]" at line ${lineIndex} has no open array to close (enclosing scope: ${describeScope(top)})`,
                })
            }
            pendingProperty = null
            continue
        }

        if (END_MARKER.test(text)) {
            if (pendingProperty) {
                pendingProperty.multiline = true
                pendingProperty.extentEndLineIndex = lineIndex
                pendingProperty = null
            }
            continue
        }

        const keyMatch = text.match(KEY_LINE)
        if (keyMatch) {
            const property = parsePropertyLine(keyMatch[1], line, lineIndex)
            if (top === undefined) {
                frontmatter.push(property)
                pendingProperty = property
            } else if (top.kind === "block") {
                top.properties.push(property)
                pendingProperty = property
            }
            // Key lines inside arrays are array-item content, not block
            // properties — ignored, and they don't accept an :end either.
            else pendingProperty = null
        }
    }

    // Unclosed blocks endanger line attribution and get reported. Unclosed
    // arrays at EOF are tolerated, as ArchieML tolerates them (and
    // gdocToArchie itself leaves a trailing bullet list's [.list] unclosed).
    for (const scope of stack) {
        if (scope.kind === "block") {
            imbalances.push({
                lineIndex: scope.openLineIndex,
                detail: `"{.${scope.type}}" opened at line ${scope.openLineIndex} is never closed`,
            })
        }
    }

    return { blocks, frontmatter, imbalances }
}

function describeScope(scope: Scope | undefined): string {
    if (!scope) return "document root"
    return scope.kind === "block" ? `{.${scope.type}}` : `[${scope.name}]`
}

export function rawLineText(line: SourceLine): string {
    const text = line.runs.map((run) => run.content).join("")
    return text.endsWith("\n") ? text.slice(0, -1) : text
}

function parsePropertyLine(
    key: string,
    line: SourceLine,
    lineIndex: number
): PropertyLine {
    const property: PropertyLine = {
        key,
        lineIndex,
        extentEndLineIndex: lineIndex,
        multiline: false,
        keyOffsetInRaw: null,
        colonEndOffsetInRaw: null,
    }
    // Only paragraph lines can be edited, so only they need raw offsets. The
    // key must appear verbatim in the doc's plain text (styled values are
    // fine; the key portion itself is always plain if ArchieML parsed it).
    if (line.kind === "paragraph") {
        const rawMatch = rawLineText(line).match(RAW_KEY_LINE)
        if (rawMatch && rawMatch[2] === key) {
            property.keyOffsetInRaw = rawMatch[1].length
            property.colonEndOffsetInRaw =
                rawMatch[0].length - (rawMatch[0].endsWith(" ") ? 1 : 0)
        }
    }
    return property
}
