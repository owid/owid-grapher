import * as _ from "lodash-es"
import { type docs_v1 } from "@googleapis/docs"
import {
    getDefaultTextStyle,
    htmlLineToTextFragments,
    TEXT_STYLE_FIELDS,
    type TextFragment,
} from "../../../db/model/Gdoc/archieToGdoc.js"
import { PatchFlag, PatchResult, RawBlockJson, SourceLine } from "../types.js"
import { BlockMatch, PropertyLine, rawLineText } from "./scopeScanner.js"

export type PropertyEdit =
    | { kind: "rename-key"; oldKey: string; newKey: string }
    | { kind: "set-value"; key: string; value: string }
    | { kind: "delete-property"; key: string }
    | { kind: "insert-property"; key: string; value: string }
    | { kind: "rename-block-type"; oldType: string; newType: string }
    | { kind: "delete-block" }

export interface BlockDiff {
    edits: PropertyEdit[]
    flags: PatchFlag[]
}

/**
 * Computes property-level edits between a block and its transformed version.
 * A removed key and an added key holding an identical value are recognized as
 * a rename, which patches only the key token and leaves the (possibly styled)
 * value untouched in the doc.
 */
export function diffBlockValues(
    before: RawBlockJson,
    after: RawBlockJson | null
): BlockDiff {
    if (after === null) return { edits: [{ kind: "delete-block" }], flags: [] }

    const edits: PropertyEdit[] = []
    const flags: PatchFlag[] = []

    if (after.type !== before.type) {
        edits.push({
            kind: "rename-block-type",
            oldType: before.type,
            newType: after.type,
        })
    }

    const definedKeys = (value: Record<string, unknown>): string[] =>
        Object.keys(value).filter((key) => value[key] !== undefined)

    const beforeKeys = definedKeys(before.value)
    const afterKeys = definedKeys(after.value)
    const removed = beforeKeys.filter((key) => !afterKeys.includes(key))
    const added = afterKeys.filter((key) => !beforeKeys.includes(key))

    // Pair up unambiguous renames (identical values) first
    const pairedAdds = new Set<string>()
    const pairedRemovals = new Set<string>()
    for (const oldKey of removed) {
        const candidates = added.filter(
            (newKey) =>
                !pairedAdds.has(newKey) &&
                _.isEqual(before.value[oldKey], after.value[newKey])
        )
        if (candidates.length === 1) {
            const newKey = candidates[0]
            pairedAdds.add(newKey)
            pairedRemovals.add(oldKey)
            edits.push({ kind: "rename-key", oldKey, newKey })
        }
    }

    for (const key of removed.filter((k) => !pairedRemovals.has(k))) {
        edits.push({ kind: "delete-property", key })
    }

    for (const key of added.filter((k) => !pairedAdds.has(k))) {
        const serialized = serializeValue(after.value[key], key, flags)
        if (serialized !== null)
            edits.push({ kind: "insert-property", key, value: serialized })
    }

    for (const key of beforeKeys.filter((k) => afterKeys.includes(k))) {
        if (_.isEqual(before.value[key], after.value[key])) continue
        const serialized = serializeValue(after.value[key], key, flags)
        if (serialized !== null)
            edits.push({ kind: "set-value", key, value: serialized })
    }

    return { edits, flags }
}

function serializeValue(
    value: unknown,
    key: string,
    flags: PatchFlag[]
): string | null {
    const serialized =
        typeof value === "string"
            ? value
            : typeof value === "boolean" || typeof value === "number"
              ? String(value)
              : null
    if (serialized === null) {
        flags.push({
            reason: "non-string-value-change",
            detail: `property "${key}" changed to a non-scalar value`,
        })
        return null
    }
    if (serialized.includes("\n")) {
        flags.push({
            reason: "multiline-value-not-supported",
            detail: `property "${key}" changed to a multiline value`,
        })
        return null
    }
    return serialized
}

interface EditGroup {
    /** Document position used for ordering; edits are applied bottom-up */
    anchor: number
    /** The doc range this group touches, for overlap detection */
    span: { startIndex: number; endIndex: number }
    requests: docs_v1.Schema$Request[]
}

/**
 * Builds one batchUpdate request list for a whole document from per-block
 * edits. Edits are ordered by descending document position so that earlier
 * requests never shift the indexes of later ones. Fails closed: any flag
 * anywhere yields an empty request list — a flagged doc is never partially
 * patched.
 */
export function buildPatches(
    lines: SourceLine[],
    blockEdits: Array<{ match: BlockMatch; edits: PropertyEdit[] }>
): PatchResult {
    const groups: EditGroup[] = []
    const flags: PatchFlag[] = []

    for (const { match, edits } of blockEdits) {
        for (const edit of edits) {
            const group = buildEditGroup(lines, match, edit, flags)
            if (group) groups.push(group)
        }
    }

    const sorted = _.sortBy(groups, (group) => group.span.startIndex)
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].span.startIndex < sorted[i - 1].span.endIndex) {
            flags.push({
                reason: "overlapping-edits",
                detail: `edits at doc indexes ${sorted[i - 1].span.startIndex} and ${sorted[i].span.startIndex} overlap`,
            })
        }
    }

    if (flags.length > 0) return { requests: [], flags }

    const requests = sorted.toReversed().flatMap((group) => group.requests)
    return { requests, flags: [] }
}

function buildEditGroup(
    lines: SourceLine[],
    match: BlockMatch,
    edit: PropertyEdit,
    flags: PatchFlag[]
): EditGroup | null {
    switch (edit.kind) {
        case "rename-key": {
            const property = findProperty(match, edit.oldKey, flags)
            if (!property) return null
            return buildTokenReplacement(
                lines,
                property.lineIndex,
                property.keyOffsetInRaw,
                edit.oldKey,
                edit.newKey,
                flags
            )
        }
        case "rename-block-type":
            return buildBlockTypeRename(lines, match, edit, flags)
        case "set-value":
            return buildSetValue(lines, match, edit, flags)
        case "delete-property":
            return buildDeleteProperty(lines, match, edit, flags)
        case "insert-property":
            return buildInsertProperty(lines, match, edit, flags)
        case "delete-block":
            return buildDeleteBlock(lines, match, flags)
    }
}

function findProperty(
    match: BlockMatch,
    key: string,
    flags: PatchFlag[]
): PropertyLine | null {
    const property = match.properties.find((p) => p.key === key)
    if (!property) {
        flags.push({
            reason: "property-line-not-found",
            detail: `no "${key}" line found in {.${match.type}} block at line ${match.openLineIndex}`,
        })
        return null
    }
    return property
}

function requirePatchableLine(
    line: SourceLine,
    what: string,
    flags: PatchFlag[]
): line is SourceLine & { range: NonNullable<SourceLine["range"]> } {
    if (line.kind !== "paragraph" || line.range === null) {
        flags.push({
            reason: "derived-or-synthetic-target-line",
            detail: `${what} targets a line that is not a plain paragraph: "${line.text}"`,
        })
        return false
    }
    return true
}

/**
 * Maps an offset within a line's raw text to an absolute doc index,
 * requiring the following `length` characters to sit inside a single textRun
 */
function docIndexForRawOffset(
    line: SourceLine,
    offset: number,
    length: number
): number | null {
    let cursor = 0
    for (const run of line.runs) {
        const runLength = run.content.length
        if (offset >= cursor && offset + length <= cursor + runLength) {
            return run.startIndex + (offset - cursor)
        }
        cursor += runLength
    }
    return null
}

function updateStyleRequest(
    startIndex: number,
    endIndex: number,
    textStyle: docs_v1.Schema$TextStyle
): docs_v1.Schema$Request {
    return {
        updateTextStyle: {
            range: { startIndex, endIndex },
            textStyle,
            fields: TEXT_STYLE_FIELDS,
        },
    }
}

/**
 * Inserts `prefix` (styled as plain text) followed by styled fragments at an
 * absolute doc index. The whole inserted range is first reset to the default
 * style so it cannot inherit link/bold styling from adjacent characters.
 */
function styledInsertRequests(
    at: number,
    prefix: string,
    fragments: TextFragment[],
    suffix = ""
): docs_v1.Schema$Request[] {
    const fragmentText = fragments.map((fragment) => fragment.text).join("")
    const fullText = prefix + fragmentText + suffix
    if (fullText === "") return []
    const requests: docs_v1.Schema$Request[] = [
        { insertText: { location: { index: at }, text: fullText } },
    ]
    const styleableLength = prefix.length + fragmentText.length
    if (styleableLength > 0) {
        requests.push(
            updateStyleRequest(at, at + styleableLength, getDefaultTextStyle())
        )
    }
    let offset = at + prefix.length
    for (const fragment of fragments) {
        if (fragment.text.length === 0) continue
        requests.push(
            updateStyleRequest(
                offset,
                offset + fragment.text.length,
                fragment.style
            )
        )
        offset += fragment.text.length
    }
    return requests
}

function buildTokenReplacement(
    lines: SourceLine[],
    lineIndex: number,
    offset: number | null,
    oldToken: string,
    newToken: string,
    flags: PatchFlag[]
): EditGroup | null {
    const line = lines[lineIndex]
    if (!requirePatchableLine(line, `renaming "${oldToken}"`, flags))
        return null
    const tokenStart =
        offset === null
            ? null
            : docIndexForRawOffset(line, offset, oldToken.length)
    if (tokenStart === null) {
        flags.push({
            reason: "key-token-not-locatable",
            detail: `could not locate "${oldToken}" in the doc text of line "${line.text}"`,
        })
        return null
    }
    return {
        anchor: tokenStart,
        span: {
            startIndex: tokenStart,
            endIndex: tokenStart + oldToken.length,
        },
        requests: [
            {
                deleteContentRange: {
                    range: {
                        startIndex: tokenStart,
                        endIndex: tokenStart + oldToken.length,
                    },
                },
            },
            { insertText: { location: { index: tokenStart }, text: newToken } },
            updateStyleRequest(
                tokenStart,
                tokenStart + newToken.length,
                getDefaultTextStyle()
            ),
        ],
    }
}

const BLOCK_OPEN_RAW = /^([ \t]*\{[.+]+)([A-Za-z0-9-_]+)/

function buildBlockTypeRename(
    lines: SourceLine[],
    match: BlockMatch,
    edit: { oldType: string; newType: string },
    flags: PatchFlag[]
): EditGroup | null {
    const line = lines[match.openLineIndex]
    if (!requirePatchableLine(line, `renaming {.${edit.oldType}}`, flags))
        return null
    const rawMatch = rawLineText(line).match(BLOCK_OPEN_RAW)
    if (!rawMatch || rawMatch[2] !== edit.oldType) {
        flags.push({
            reason: "key-token-not-locatable",
            detail: `could not locate "{.${edit.oldType}}" in the doc text of line "${line.text}"`,
        })
        return null
    }
    return buildTokenReplacement(
        lines,
        match.openLineIndex,
        rawMatch[1].length,
        edit.oldType,
        edit.newType,
        flags
    )
}

function buildSetValue(
    lines: SourceLine[],
    match: BlockMatch,
    edit: { key: string; value: string },
    flags: PatchFlag[]
): EditGroup | null {
    const property = findProperty(match, edit.key, flags)
    if (!property) return null
    const line = lines[property.lineIndex]
    if (!requirePatchableLine(line, `setting "${edit.key}"`, flags)) return null
    if (property.multiline) {
        flags.push({
            reason: "multiline-value-not-supported",
            detail: `property "${edit.key}" has a multiline (:end) value in the doc`,
        })
        return null
    }
    if (line.containsChip || line.containsInlineObject) {
        flags.push({
            reason: "chip-in-target-line",
            detail: `the "${edit.key}" line contains a smart chip or inline object`,
        })
        return null
    }
    if (property.colonEndOffsetInRaw === null) {
        flags.push({
            reason: "key-token-not-locatable",
            detail: `could not locate "${edit.key}:" in the doc text of line "${line.text}"`,
        })
        return null
    }
    const valueStart = docIndexForRawOffset(
        line,
        property.colonEndOffsetInRaw,
        0
    )
    if (valueStart === null) {
        flags.push({
            reason: "key-token-not-locatable",
            detail: `could not map the value position of "${edit.key}" to a doc index`,
        })
        return null
    }
    const lineEnd = line.range.endIndex - 1 // keep the paragraph's newline
    const requests: docs_v1.Schema$Request[] = []
    if (valueStart < lineEnd) {
        requests.push({
            deleteContentRange: {
                range: { startIndex: valueStart, endIndex: lineEnd },
            },
        })
    }
    requests.push(
        ...styledInsertRequests(
            valueStart,
            " ",
            htmlLineToTextFragments(edit.value)
        )
    )
    return {
        anchor: valueStart,
        span: { startIndex: valueStart, endIndex: lineEnd },
        requests,
    }
}

function buildDeleteProperty(
    lines: SourceLine[],
    match: BlockMatch,
    edit: { key: string },
    flags: PatchFlag[]
): EditGroup | null {
    const property = findProperty(match, edit.key, flags)
    if (!property) return null
    const extent = lines.slice(
        property.lineIndex,
        property.extentEndLineIndex + 1
    )
    if (extent.some((line) => line.range === null)) {
        flags.push({
            reason: "derived-or-synthetic-target-line",
            detail: `the value of "${edit.key}" spans lines without a doc range`,
        })
        return null
    }
    const startIndex = extent[0].range!.startIndex
    const endIndex = extent[extent.length - 1].range!.endIndex
    return {
        anchor: startIndex,
        span: { startIndex, endIndex },
        requests: [{ deleteContentRange: { range: { startIndex, endIndex } } }],
    }
}

function buildInsertProperty(
    lines: SourceLine[],
    match: BlockMatch,
    edit: { key: string; value: string },
    flags: PatchFlag[]
): EditGroup | null {
    const closeLine = lines[match.closeLineIndex]
    if (closeLine.kind !== "paragraph" || closeLine.range === null) {
        flags.push({
            reason: "block-open-or-close-line-not-patchable",
            detail: `cannot insert "${edit.key}" before the {.${match.type}} block's closing tag`,
        })
        return null
    }
    const at = closeLine.range.startIndex
    return {
        anchor: at,
        span: { startIndex: at, endIndex: at },
        requests: styledInsertRequests(
            at,
            `${edit.key}: `,
            htmlLineToTextFragments(edit.value),
            "\n"
        ),
    }
}

function buildDeleteBlock(
    lines: SourceLine[],
    match: BlockMatch,
    flags: PatchFlag[]
): EditGroup | null {
    const openLine = lines[match.openLineIndex]
    const closeLine = lines[match.closeLineIndex]
    if (openLine.range === null || closeLine.range === null) {
        flags.push({
            reason: "block-open-or-close-line-not-patchable",
            detail: `cannot delete {.${match.type}} block: its open or close tag has no doc range`,
        })
        return null
    }
    const startIndex = openLine.range.startIndex
    const endIndex = closeLine.range.endIndex
    return {
        anchor: startIndex,
        span: { startIndex, endIndex },
        requests: [{ deleteContentRange: { range: { startIndex, endIndex } } }],
    }
}
