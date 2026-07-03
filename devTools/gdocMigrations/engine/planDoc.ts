import * as _ from "lodash-es"
import { type docs_v1 } from "@googleapis/docs"
import {
    ComponentGdocMigration,
    FrontmatterGdocMigration,
    GdocMigration,
    MigrationContext,
    PatchFlag,
    SourceLine,
    SourceRange,
} from "../types.js"
import { gdocToSourceMappedLines } from "./sourceMap.js"
import {
    BlockMatch,
    PropertyLine,
    ScanResult,
    scanScopes,
} from "./scopeScanner.js"
import { extractRawBlock } from "./extractBlock.js"
import {
    buildPatches,
    diffBlockValues,
    PropertyEdit,
} from "./propertyPatcher.js"
import { collectSuggestedRanges, rangesIntersect } from "./suggestions.js"

export interface BlockEditPlan {
    match: BlockMatch
    edits: PropertyEdit[]
}

export interface DocPlan {
    gdocId: string
    revisionId: string | null
    /** Empty whenever flags are present — a flagged doc is never patched */
    requests: docs_v1.Schema$Request[]
    flags: PatchFlag[]
    blockEdits: BlockEditPlan[]
    /** Human-readable edit descriptions, used for reporting and grouping */
    editSummaries: string[]
    matchedBlockCount: number
    /** Source-mapped lines of the fetched doc, kept for post-apply verification */
    lines: SourceLine[]
}

interface ModePlan {
    flags: PatchFlag[]
    blockEdits: BlockEditPlan[]
    editSummaries: string[]
    matchedCount: number
    /** Doc ranges that must not overlap pending suggestions */
    suggestionSensitiveRanges: SourceRange[]
}

/**
 * Computes everything the engine wants to do to one document: pure given the
 * fetched document JSON, no API or DB access. Fails closed — any doubt
 * anywhere surfaces as a flag and an empty request list.
 */
export async function planDocumentPatch(
    gdocId: string,
    document: docs_v1.Schema$Document,
    migration: GdocMigration
): Promise<DocPlan> {
    const lines = gdocToSourceMappedLines(document)
    const scan = scanScopes(lines)

    const modePlan =
        migration.mode === "frontmatter"
            ? planFrontmatterMode(lines, scan, migration)
            : await planComponentMode(gdocId, lines, scan, migration)

    const flags = [...modePlan.flags]

    // Pending suggestions overlapping an edit target: skip and flag. Scoped
    // to the targets — suggestions elsewhere in the doc are fine, since
    // SUGGESTIONS_INLINE indexes match what batchUpdate operates on.
    if (modePlan.blockEdits.length > 0) {
        const suggestedRanges = collectSuggestedRanges(document)
        for (const range of modePlan.suggestionSensitiveRanges) {
            if (suggestedRanges.some((s) => rangesIntersect(s, range))) {
                flags.push({
                    reason: "pending-suggestions-in-target",
                    detail: `a pending suggestion overlaps an edit target (doc indexes ${range.startIndex}–${range.endIndex})`,
                })
            }
        }
    }

    const patch = buildPatches(lines, modePlan.blockEdits)
    const allFlags = [...flags, ...patch.flags]

    return {
        gdocId,
        revisionId: document.revisionId ?? null,
        requests: allFlags.length > 0 ? [] : patch.requests,
        flags: allFlags,
        blockEdits: modePlan.blockEdits,
        editSummaries: modePlan.editSummaries,
        matchedBlockCount: modePlan.matchedCount,
        lines,
    }
}

// ---------------------------------------------------------------------------
// Component mode
// ---------------------------------------------------------------------------

async function planComponentMode(
    gdocId: string,
    lines: SourceLine[],
    scan: ScanResult,
    migration: ComponentGdocMigration
): Promise<ModePlan> {
    const context: MigrationContext = { gdocId }
    const matches = scan.blocks.filter(
        (block) => block.type === migration.blockType
    )

    const flags: PatchFlag[] = []
    const blockEdits: BlockEditPlan[] = []
    const editSummaries: string[] = []
    const suggestionSensitiveRanges: SourceRange[] = []

    if (matches.length > 0 && !scan.balanced) {
        flags.push({
            reason: "unbalanced-scopes",
            detail: "the document's ArchieML scopes don't pair up cleanly",
        })
    }

    for (const match of matches) {
        const block = extractRawBlock(lines, match)
        if (!block) continue

        const transformed = await migration.transform(
            structuredClone(block),
            context
        )
        const diff = diffBlockValues(block, transformed)
        flags.push(...diff.flags)
        if (diff.edits.length === 0) continue

        // The post-apply verification re-runs the transform and expects a
        // no-op, so transforms must be idempotent. Catch violations at plan
        // time, before anything is written.
        if (transformed !== null) {
            const twice = await migration.transform(
                structuredClone(transformed),
                context
            )
            if (!_.isEqual(twice, transformed)) {
                flags.push({
                    reason: "non-idempotent-transform",
                    detail: `transform({.${block.type}}) keeps changing when re-applied to its own output`,
                })
            }
        }

        blockEdits.push({ match, edits: diff.edits })
        editSummaries.push(
            ...diff.edits.map((edit) => describeEdit(`{.${match.type}}`, edit))
        )
        const blockRange = blockDocRange(lines, match)
        if (blockRange) suggestionSensitiveRanges.push(blockRange)
    }

    return {
        flags,
        blockEdits,
        editSummaries,
        matchedCount: matches.length,
        suggestionSensitiveRanges,
    }
}

function blockDocRange(
    lines: SourceLine[],
    match: BlockMatch
): SourceRange | null {
    const open = lines[match.openLineIndex].range
    const close = lines[match.closeLineIndex].range
    if (!open || !close) return null
    return { startIndex: open.startIndex, endIndex: close.endIndex }
}

// ---------------------------------------------------------------------------
// Frontmatter mode
// ---------------------------------------------------------------------------

const FRONTMATTER_VALUE = /^[A-Za-z0-9-_.]+[ \t]*:[ ]?(.*)$/

function rawFrontmatterValue(line: SourceLine): string {
    return line.text.trim().match(FRONTMATTER_VALUE)?.[1] ?? ""
}

/**
 * Turns declarative frontmatter ops into property edits against the doc's
 * top-level key lines. Keys are matched case-insensitively (the parser
 * lowercases them). The resulting edits are fed through the same patcher as
 * component edits via a synthetic "block" spanning the frontmatter — the
 * patcher only cares about property lines and an insertion anchor.
 */
function planFrontmatterMode(
    lines: SourceLine[],
    scan: ScanResult,
    migration: FrontmatterGdocMigration
): ModePlan {
    const properties = scan.frontmatter
    const flags: PatchFlag[] = []
    const edits: PropertyEdit[] = []
    const editSummaries: string[] = []
    const suggestionSensitiveRanges: SourceRange[] = []
    const matchedKeys = new Set<string>()

    const findProperty = (key: string): PropertyLine | null => {
        const matches = properties.filter(
            (property) => property.key.toLowerCase() === key.toLowerCase()
        )
        if (matches.length > 1) {
            flags.push({
                reason: "duplicate-frontmatter-key",
                detail: `the key "${key}" appears ${matches.length} times at the top level`,
            })
            return null
        }
        return matches[0] ?? null
    }

    const markSensitive = (property: PropertyLine): void => {
        const first = lines[property.lineIndex].range
        const last = lines[property.extentEndLineIndex].range
        if (first && last) {
            suggestionSensitiveRanges.push({
                startIndex: first.startIndex,
                endIndex: last.endIndex,
            })
        }
    }

    const pushEdit = (edit: PropertyEdit): void => {
        edits.push(edit)
        editSummaries.push(describeEdit("frontmatter", edit))
    }

    for (const op of migration.ops) {
        switch (op.kind) {
            case "rename-key": {
                const property = findProperty(op.from)
                if (!property) break
                matchedKeys.add(op.from)
                if (property.key === op.to) break
                if (findProperty(op.to)) {
                    flags.push({
                        reason: "duplicate-frontmatter-key",
                        detail: `renaming "${op.from}" → "${op.to}" but "${op.to}" already exists`,
                    })
                    break
                }
                pushEdit({
                    kind: "rename-key",
                    oldKey: property.key,
                    newKey: op.to,
                })
                markSensitive(property)
                break
            }
            case "remove-key": {
                const property = findProperty(op.key)
                if (!property) break
                matchedKeys.add(op.key)
                pushEdit({ kind: "delete-property", key: property.key })
                markSensitive(property)
                break
            }
            case "set-value": {
                const raw = String(op.value)
                const property = findProperty(op.key)
                if (!property) {
                    pushEdit({
                        kind: "insert-property",
                        key: op.key,
                        value: raw,
                    })
                    break
                }
                matchedKeys.add(op.key)
                if (rawFrontmatterValue(lines[property.lineIndex]) === raw)
                    break
                pushEdit({ kind: "set-value", key: property.key, value: raw })
                markSensitive(property)
                break
            }
            case "map-value": {
                const property = findProperty(op.key)
                if (!property) break
                matchedKeys.add(op.key)
                const current = rawFrontmatterValue(lines[property.lineIndex])
                const mapped = op.map(current)
                if (mapped === null || mapped === undefined) {
                    pushEdit({ kind: "delete-property", key: property.key })
                    markSensitive(property)
                    break
                }
                const raw = String(mapped)
                const twice = op.map(raw)
                if (
                    twice !== null &&
                    twice !== undefined &&
                    String(twice) !== raw
                ) {
                    flags.push({
                        reason: "non-idempotent-transform",
                        detail: `mapValue("${op.key}") keeps changing when re-applied to its own output`,
                    })
                    break
                }
                if (raw === current) break
                pushEdit({ kind: "set-value", key: property.key, value: raw })
                markSensitive(property)
                break
            }
        }
    }

    const blockEdits: BlockEditPlan[] = []
    if (edits.length > 0) {
        // Insertion anchor: the line right after the last frontmatter key
        // (or the top of the doc when there is none). The patcher inserts
        // new properties before this line and flags if it isn't patchable.
        const lastProperty = properties[properties.length - 1]
        const anchorLineIndex = lastProperty ? lastProperty.lineIndex + 1 : 0
        if (anchorLineIndex >= lines.length) {
            flags.push({
                reason: "block-open-or-close-line-not-patchable",
                detail: "no line after the last frontmatter key to anchor edits against",
            })
        } else {
            blockEdits.push({
                match: {
                    type: "frontmatter",
                    openLineIndex: properties[0]?.lineIndex ?? 0,
                    closeLineIndex: anchorLineIndex,
                    properties,
                },
                edits,
            })
        }
    }

    return {
        flags,
        blockEdits,
        editSummaries,
        matchedCount: matchedKeys.size,
        suggestionSensitiveRanges,
    }
}

// ---------------------------------------------------------------------------

const TRUNCATE_AT = 80

function truncate(value: string): string {
    return value.length > TRUNCATE_AT
        ? `${value.slice(0, TRUNCATE_AT)}…`
        : value
}

export function describeEdit(label: string, edit: PropertyEdit): string {
    switch (edit.kind) {
        case "rename-key":
            return `${label}: rename "${edit.oldKey}" → "${edit.newKey}"`
        case "set-value":
            return `${label}: set "${edit.key}" = "${truncate(edit.value)}"`
        case "delete-property":
            return `${label}: remove "${edit.key}"`
        case "insert-property":
            return `${label}: add "${edit.key}" = "${truncate(edit.value)}"`
        case "rename-block-type":
            return `{.${edit.oldType}} → {.${edit.newType}}`
        case "delete-block":
            return `${label}: delete block`
    }
}
