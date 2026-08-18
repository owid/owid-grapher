import {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
    Span,
} from "@ourworldindata/types"
import { traverseEnrichedBlock } from "@ourworldindata/utils"
import { enrichedBlockToRawBlock } from "../db/model/Gdoc/enrichedToRaw.js"
import { parseRawBlocksToEnrichedBlocks } from "../db/model/Gdoc/rawToEnriched.js"

/**
 * The minimal-source machinery behind the writing reference: reduce a block
 * to the shortest ArchieML an author would type for it, and reshape such a
 * block by prop overrides (the form builder). Shared by the instances/draft
 * API routes and the preview renderer.
 */

/**
 * A block reduced to its minimal source: the raw form with every prop the
 * parser re-injects on its own (a default) stripped away. Two invariants
 * follow, and both matter:
 *
 * - Stored configs are parser output of varying vintage — the same authoring
 *   is stored with or without injected defaults depending on when its doc
 *   was last saved. Minimization compares re-parses in TODAY's parser space,
 *   so vintage differences collapse and analysis can never depend on when a
 *   doc was saved.
 * - What survives is exactly what makes the block this block: required props
 *   (stripping them changes the parse) and deviations from defaults. The
 *   displayed ArchieML is generated from the same minimization, so the
 *   reference always shows the canonical, shortest way to type each form.
 */
export interface MinimalBlock {
    raw: OwidRawGdocBlock
    /** The surviving (authored, non-empty) value props of the minimal raw */
    props: Record<string, unknown>
}

export function tryParseRaw(
    raw: OwidRawGdocBlock
): OwidEnrichedGdocBlock | undefined {
    try {
        return parseRawBlocksToEnrichedBlocks(raw) ?? undefined
    } catch {
        return undefined
    }
}

export function minimizeRaw(raw: OwidRawGdocBlock): MinimalBlock {
    const value = (raw as { value?: unknown }).value
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return { raw, props: {} }
    const props = value as Record<string, unknown>
    for (const key of Object.keys(props)) {
        if (props[key] === undefined) delete props[key]
    }

    // Strip every prop whose removal is parse-invariant — the parser fills
    // defaults back in, so removing one doesn't change the result, while
    // removing a required prop or a non-default value does. Only applies
    // when the block parses cleanly: container blocks are stored without
    // their child blocks, so they parse to an error either way and stripping
    // would erase real props. (JSON.stringify comparison is deterministic
    // because the parsers build their result objects in a fixed order.)
    const baseEnriched = tryParseRaw(raw)
    if (baseEnriched && (baseEnriched.parseErrors ?? []).length === 0) {
        const base = JSON.stringify(baseEnriched)
        for (const key of Object.keys(props)) {
            const kept = props[key]
            delete props[key]
            const reparsed = tryParseRaw(raw)
            if (!reparsed || JSON.stringify(reparsed) !== base)
                props[key] = kept
        }
    }

    const authored: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(props)) {
        if (v === null) continue
        if (typeof v === "string" && v.trim() === "") continue
        if (Array.isArray(v) && v.length === 0) continue
        authored[key] = v
    }
    return { raw, props: authored }
}

/**
 * Stored content of older vintage carries `span-ref` spans without the
 * `sourceForm` the ArchieML serializer needs — it cannot reconstruct the
 * `{ref}…{/ref}` source, so serialization throws. Degrade those spans to the
 * plain link they render as (same url, same children) on a clone, so the
 * block's minimal source can still be built. Only the ref markup is lost —
 * legible in the output, never a silent failure of the whole block.
 */
export function sanitizeLegacySpans(
    block: OwidEnrichedGdocBlock
): OwidEnrichedGdocBlock {
    const clone = structuredClone(block)
    try {
        traverseEnrichedBlock(
            clone,
            () => undefined,
            (span: Span) => {
                if (span.spanType === "span-ref" && !span.sourceForm)
                    (span as { spanType: string }).spanType = "span-link"
            }
        )
    } catch {
        // an unknown node shape aborts sanitization; serialization will
        // report the block as unbuildable, same as before
    }
    return clone
}

/**
 * Property overrides an author cycled in the form builder: a scalar value
 * (raw blocks hold strings everywhere) sets the prop, null removes it.
 */
export type DraftOverrides = Record<string, string | null>

/** Parse the builder's ?overrides= query param; undefined when absent or invalid. */
export function parseDraftOverrides(
    param: string | undefined
): DraftOverrides | undefined {
    if (!param) return undefined
    let parsed: unknown
    try {
        parsed = JSON.parse(param)
    } catch {
        return undefined
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
        return undefined
    const overrides: DraftOverrides = {}
    for (const [key, value] of Object.entries(parsed)) {
        if (value === null) overrides[key] = null
        else if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
        )
            overrides[key] = String(value)
        else return undefined
    }
    return Object.keys(overrides).length > 0 ? overrides : undefined
}

/**
 * Apply builder overrides to a real block: reduce it to its minimal source,
 * set/remove the cycled props on the raw form, and minimize again so an
 * override that merely restates a parser default vanishes — the draft's
 * ArchieML and surviving props stay canonical. Returns undefined for blocks
 * whose raw form has no prop object to shape (e.g. plain text).
 */
export function applyDraftOverrides(
    block: OwidEnrichedGdocBlock,
    overrides: DraftOverrides
): MinimalBlock | undefined {
    let minimal: MinimalBlock
    try {
        minimal = minimizeRaw(enrichedBlockToRawBlock(sanitizeLegacySpans(block)))
    } catch {
        return undefined
    }
    const value = (minimal.raw as { value?: unknown }).value
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return undefined
    const props = value as Record<string, unknown>
    for (const [key, override] of Object.entries(overrides)) {
        if (override === null) delete props[key]
        else props[key] = override
    }
    return minimizeRaw(minimal.raw)
}
