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

export interface ScanResult {
    /** Every {.type} block in the doc, in document order, at any nesting depth */
    blocks: BlockMatch[]
    /** Top-level key: value lines outside any scope */
    frontmatter: PropertyLine[]
    /** False when scope open/close markers didn't pair up cleanly */
    balanced: boolean
}

const BLOCK_OPEN = /^\{[.+]+([A-Za-z0-9-_]+)\}$/
const BLOCK_CLOSE = /^\{\}$/
const ARRAY_OPEN = /^\[[.+]+([A-Za-z0-9-_.]+)\]$/
const ARRAY_CLOSE = /^\[\]$/
const END_MARKER = /^:end$/i
const KEY_LINE = /^([A-Za-z0-9-_.]+)[ \t]*:/
const RAW_KEY_LINE = /^([ \t]*)([A-Za-z0-9-_.]+)[ \t]*:[ ]?/

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
    let balanced = true
    // The property a subsequent ":end" would attach to. Reset on any scope
    // change, mirroring how ArchieML flushes its buffer.
    let pendingProperty: PropertyLine | null = null

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex]
        const text = line.text.trim()
        const top = stack[stack.length - 1]

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
                balanced = false
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
                balanced = false
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

    if (stack.length > 0) balanced = false

    return { blocks, frontmatter, balanced }
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
