import {
    BlockTransformFn,
    EnrichedBlockJson,
    EnrichedTransformFn,
    FrontmatterOp,
    RawBlockJson,
} from "./types.js"

export function renameObjectKey(
    object: Record<string, unknown>,
    from: string,
    to: string
): Record<string, unknown> {
    const renamed: Record<string, unknown> = {}
    // preserve key order so diffs stay minimal
    for (const [key, value] of Object.entries(object)) {
        renamed[key === from ? to : key] = value
    }
    return renamed
}

/** Renames a property on the block's value, preserving its value untouched */
export function renameProperty(from: string, to: string): BlockTransformFn {
    return (block) => {
        if (!(from in block.value)) return block
        return { ...block, value: renameObjectKey(block.value, from, to) }
    }
}

export function removeProperty(key: string): BlockTransformFn {
    return (block) => {
        if (!(key in block.value)) return block
        const value = { ...block.value }
        delete value[key]
        return { ...block, value }
    }
}

export function rewriteProperty(
    key: string,
    rewrite: (value: unknown) => unknown
): BlockTransformFn {
    return (block) => {
        if (!(key in block.value)) return block
        return {
            ...block,
            value: { ...block.value, [key]: rewrite(block.value[key]) },
        }
    }
}

export function renameBlockType(newType: string): BlockTransformFn {
    return (block) => ({ ...block, type: newType })
}

/** Applies transforms left to right, stopping if one deletes the block */
export function composeTransforms(
    ...transforms: BlockTransformFn[]
): BlockTransformFn {
    return async (block, context) => {
        let current: RawBlockJson | null = block
        for (const transform of transforms) {
            if (current === null) return null
            current = await transform(current, context)
        }
        return current
    }
}

// ---------------------------------------------------------------------------
// Enriched-side (posts_gdocs.content) counterparts, for dbTransform. Enriched
// blocks hold properties directly on the block object, so renames/removals
// work the same way — the values themselves (span arrays etc.) move untouched.
// ---------------------------------------------------------------------------

export function renameEnrichedProperty(
    from: string,
    to: string
): EnrichedTransformFn {
    return (block) => {
        if (!(from in block)) return block
        return renameObjectKey(block, from, to) as EnrichedBlockJson
    }
}

export function removeEnrichedProperty(key: string): EnrichedTransformFn {
    return (block) => {
        if (!(key in block)) return block
        const result = { ...block }
        delete result[key]
        return result
    }
}

export function composeEnrichedTransforms(
    ...transforms: EnrichedTransformFn[]
): EnrichedTransformFn {
    return async (block, context) => {
        let current: EnrichedBlockJson | null = block
        for (const transform of transforms) {
            if (current === null) return null
            current = await transform(current, context)
        }
        return current
    }
}

// ---------------------------------------------------------------------------
// Frontmatter op constructors (see FrontmatterOp in types.ts). Keys are
// matched case-insensitively in the doc (the parser lowercases them anyway).
// ---------------------------------------------------------------------------

export function renameKey(from: string, to: string): FrontmatterOp {
    return { kind: "rename-key", from, to }
}

export function removeKey(key: string): FrontmatterOp {
    return { kind: "remove-key", key }
}

export function setValue(
    key: string,
    value: string | boolean | number,
    dbValue?: unknown
): FrontmatterOp {
    return { kind: "set-value", key, value, dbValue }
}

export function mapValue(
    key: string,
    map: (value: unknown) => unknown
): FrontmatterOp {
    return { kind: "map-value", key, map }
}
