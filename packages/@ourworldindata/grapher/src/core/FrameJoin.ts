// Lightweight columnar frames and join routines used by LegacyToOwidTable.
//
// Building charts from large daily indicators can involve hundreds of thousands
// of rows. Operating on plain column arrays avoids constructing intermediate
// OwidTables and lets common cases (aligned keys, fallback-only joins) reuse
// column arrays without copying.

import { ColumnSlug } from "@ourworldindata/utils"
import { CoreValueType, OwidColumnDef } from "@ourworldindata/types"
import { ErrorValueTypes, OwidTable } from "@ourworldindata/core-table"

export interface FrameColumn {
    def: OwidColumnDef
    values: CoreValueType[]
}

export interface Frame {
    /** In output order */
    columns: FrameColumn[]
    numRows: number
    /** Set when every row is known to have a distinct value for these key columns */
    uniqueKey?: string
}

export type PairKey = readonly [ColumnSlug, ColumnSlug]
export type JoinKey = readonly [ColumnSlug] | PairKey

export const EMPTY_FRAME: Frame = { columns: [], numRows: 0 }

export const findColumn = (
    frame: Frame,
    slug: ColumnSlug
): FrameColumn | undefined =>
    frame.columns.find((column) => column.def.slug === slug)

export const frameToTable = (frame: Frame): OwidTable =>
    new OwidTable(
        [],
        frame.columns.map(({ def, values }) => ({ ...def, values }))
    )

// ---------------------------------------------------------------------------
// Full outer join (frames sharing the same 2-column primary key)
// ---------------------------------------------------------------------------

/**
 * Full outer join of frames that all share the given 2-column `key`.
 *
 * Columns present in every frame (the key columns plus shared entity metadata
 * like entityName) appear once in the result, taken from the first
 * frame that introduces each key; we assume they agree across frames. All other
 * columns are kept from their originating frame, with
 * `ErrorValueTypes.NoMatchingValueAfterJoin` where a frame has no row for a key.
 */
export const fullJoin = (frames: Frame[], key: PairKey): Frame => {
    if (frames.length === 0) return EMPTY_FRAME
    // Not marked as unique: a single frame can still have duplicate keys
    if (frames.length === 1) return frames[0]

    const uniqueKey = key.join(",")
    const [firstFrame] = frames
    const sharedSlugs = getSharedColumnSlugs(frames)
    const sharedSlugSet = new Set(sharedSlugs)

    // Fast path: every frame has the same unique keys in the same order, so
    // reuse all column arrays directly without building any lookup tables.
    if (haveIdenticalKeys(frames, key) && isUniqueOnKey(firstFrame, key))
        return joinAlignedFrames(frames, sharedSlugs, sharedSlugSet, uniqueKey)

    const { rowsByFrame, ownerFrame, ownerRow } = enumerateKeys(frames, key)
    const numOutRows = ownerFrame.length

    // Keys are enumerated in frame order. If frame 0 owns the last output row,
    // it owns all of them; equal row counts also prove its keys were unique, so
    // its column arrays can be reused as-is.
    const firstFrameOwnsAllRows =
        numOutRows === firstFrame.numRows &&
        (numOutRows === 0 || ownerFrame[numOutRows - 1] === 0)

    const outColumns: FrameColumn[] = sharedSlugs.map((slug) => {
        const firstColumn = findColumn(firstFrame, slug)!
        const def = { ...firstColumn.def }
        if (firstFrameOwnsAllRows) return { def, values: firstColumn.values }

        const sources = frames.map((frame) => findColumn(frame, slug)!.values)
        const values: CoreValueType[] = []
        for (let outRow = 0; outRow < numOutRows; outRow++)
            values.push(sources[ownerFrame[outRow]][ownerRow[outRow]])
        return { def, values }
    })

    frames.forEach((frame, frameIndex) => {
        for (const column of frame.columns) {
            if (sharedSlugSet.has(column.def.slug)) continue
            const values =
                frameIndex === 0 && firstFrameOwnsAllRows
                    ? column.values
                    : gatherColumnValues(column.values, rowsByFrame[frameIndex])
            outColumns.push({ def: { ...column.def }, values })
        }
    })

    return { columns: outColumns, numRows: numOutRows, uniqueKey }
}

/** Zero-copy join when all frames already share identical unique keys in the same order */
const joinAlignedFrames = (
    frames: Frame[],
    sharedSlugs: ColumnSlug[],
    sharedSlugSet: Set<ColumnSlug>,
    uniqueKey: string
): Frame => {
    const [firstFrame] = frames
    const outColumns: FrameColumn[] = sharedSlugs.map((slug) => {
        const column = findColumn(firstFrame, slug)!
        return { def: { ...column.def }, values: column.values }
    })
    for (const frame of frames) {
        for (const column of frame.columns) {
            if (!sharedSlugSet.has(column.def.slug))
                outColumns.push({
                    def: { ...column.def },
                    values: column.values,
                })
        }
    }
    return { columns: outColumns, numRows: firstFrame.numRows, uniqueKey }
}

// ---------------------------------------------------------------------------
// Left join with fallback keys (attaching secondary frames onto a base index)
// ---------------------------------------------------------------------------

/**
 * Attaches `otherFrames` onto `baseFrame`, keeping `baseFrame`'s unique rows
 * (on `baseKey`) as the output index.
 *
 * Each secondary frame is matched against `baseFrame` by trying `fallbackKeys`
 * in order (e.g. year+entity, then entity alone). When several rows in a
 * secondary frame share a fallback key, the last one wins (usually the most
 * recent time; a proper fix would be a time- and tolerance-aware join).
 */
export const leftJoinWithFallbacks = (
    baseFrame: Frame,
    otherFrames: Frame[],
    baseKey: PairKey,
    fallbackKeys: JoinKey[]
): Frame => {
    if (otherFrames.length === 0) return baseFrame

    const base =
        baseFrame.numRows === 0 || isUniqueOnKey(baseFrame, baseKey)
            ? baseFrame
            : deduplicateOnKey(baseFrame, baseKey)

    const sharedSlugs = getSharedColumnSlugs([base, ...otherFrames])
    const sharedSlugSet = new Set(sharedSlugs)

    // Shared columns come first (ordered by the last frame to preserve legacy
    // column order), followed by base's remaining columns, all reused directly.
    const outColumns: FrameColumn[] = [
        ...sharedSlugs.map((slug) => {
            const column = findColumn(base, slug)!
            return { def: { ...column.def }, values: column.values }
        }),
        ...base.columns
            .filter((column) => !sharedSlugSet.has(column.def.slug))
            .map((column) => ({
                def: { ...column.def },
                values: column.values,
            })),
    ]

    for (const otherFrame of otherFrames) {
        const valueColumns = otherFrame.columns.filter(
            (column) => !sharedSlugSet.has(column.def.slug)
        )
        if (valueColumns.length === 0) continue

        if (base.numRows === 0) {
            for (const column of valueColumns)
                outColumns.push({ def: { ...column.def }, values: [] })
            continue
        }

        const matchedRows = matchRowsByFallbacks(base, otherFrame, fallbackKeys)
        for (const column of valueColumns)
            outColumns.push({
                def: { ...column.def },
                values: gatherColumnValues(column.values, matchedRows),
            })
    }

    return {
        columns: outColumns,
        numRows: base.numRows,
        uniqueKey: baseKey.join(","),
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Nested Map keyed by a pair of values, avoiding string concatenation per row.
 */
class PairMap<T> {
    private readonly outer = new Map<CoreValueType, Map<CoreValueType, T>>()

    get(first: CoreValueType, second: CoreValueType): T | undefined {
        return this.outer.get(first)?.get(second)
    }

    set(first: CoreValueType, second: CoreValueType, value: T): void {
        let inner = this.outer.get(first)
        if (inner === undefined) {
            inner = new Map<CoreValueType, T>()
            this.outer.set(first, inner)
        }
        inner.set(second, value)
    }
}

const getPairKeyColumns = (
    frame: Frame,
    key: PairKey
): [CoreValueType[], CoreValueType[]] | undefined => {
    const first = findColumn(frame, key[0])?.values
    const second = findColumn(frame, key[1])?.values
    if (!first || !second) return undefined
    return [first, second]
}

/**
 * Slugs present in every frame, ordered by the last frame to match the legacy
 * column order.
 */
const getSharedColumnSlugs = (frames: Frame[]): ColumnSlug[] =>
    frames[frames.length - 1].columns
        .map((column) => column.def.slug)
        .filter((slug) =>
            frames.every((frame) => findColumn(frame, slug) !== undefined)
        )

const gatherColumnValues = (
    source: CoreValueType[],
    rowIndices: Int32Array
): CoreValueType[] => {
    const values: CoreValueType[] = []
    for (const row of rowIndices) {
        values.push(
            row === -1 ? ErrorValueTypes.NoMatchingValueAfterJoin : source[row]
        )
    }
    return values
}

const logDuplicateJoinKey = (): void => {
    console.error("Found more than one matching row for a join key in a frame")
}

// ---------------------------------------------------------------------------
// Key alignment, uniqueness & enumeration
// ---------------------------------------------------------------------------

/** Whether every frame has the key columns with the same values in the same order */
const haveIdenticalKeys = (frames: Frame[], key: PairKey): boolean => {
    const firstColumns = getPairKeyColumns(frames[0], key)
    if (!firstColumns) return false
    const { numRows } = frames[0]
    for (let frameIndex = 1; frameIndex < frames.length; frameIndex++) {
        if (frames[frameIndex].numRows !== numRows) return false
        const columns = getPairKeyColumns(frames[frameIndex], key)
        if (!columns) return false
        for (let col = 0; col < 2; col++) {
            const first = firstColumns[col]
            const other = columns[col]
            if (first === other) continue
            for (let row = 0; row < numRows; row++)
                if (other[row] !== first[row]) return false
        }
    }
    return true
}

/**
 * Cheap check that no two rows of `frame` share a `(time, entity)` key.
 * Succeeds if the frame came out of a join on this key, or if each entity's
 * rows form a single contiguous run with strictly increasing times (the usual
 * layout of our data). Returns false when it cannot prove uniqueness cheaply.
 */
const isUniqueOnKey = (frame: Frame, key: PairKey): boolean => {
    if (frame.uniqueKey === key.join(",")) return true
    const columns = getPairKeyColumns(frame, key)
    if (!columns) return false
    const [times, entities] = columns
    const seenEntities = new Set<number>()
    for (let row = 0; row < frame.numRows; row++) {
        const time = times[row]
        const entity = entities[row]
        if (typeof time !== "number" || typeof entity !== "number") return false
        if (row > 0 && entity === entities[row - 1]) {
            // Strict `>` also rejects NaN times within a run
            if (!(time > (times[row - 1] as number))) return false
        } else {
            // A new run starts; the entity must not have appeared earlier
            if (seenEntities.has(entity)) return false
            seenEntities.add(entity)
        }
    }
    return true
}

const enumerateKeys = (
    frames: Frame[],
    key: PairKey
): { rowsByFrame: Int32Array[]; ownerFrame: number[]; ownerRow: number[] } => {
    const { outRowsByFrame, ownerFrame, ownerRow } = assignOutputRows(
        frames,
        key
    )
    const numOutRows = ownerFrame.length
    const rowsByFrame = outRowsByFrame.map((outRows) =>
        invertToFirstRowPerKey(outRows, numOutRows)
    )
    return { rowsByFrame, ownerFrame, ownerRow }
}

/** Assigns each unique key an output row index in frame order */
const assignOutputRows = (
    frames: Frame[],
    key: PairKey
): {
    outRowsByFrame: Int32Array[]
    ownerFrame: number[]
    ownerRow: number[]
} => {
    const outIndex = new PairMap<number>()
    const ownerFrame: number[] = []
    const ownerRow: number[] = []

    const outRowsByFrame = frames.map((frame, frameIndex) => {
        const columns = getPairKeyColumns(frame, key)
        if (!columns)
            throw new Error(`Frame ${frameIndex} is missing join key columns`)
        const [firstKey, secondKey] = columns
        const outRows = new Int32Array(frame.numRows)
        for (let row = 0; row < frame.numRows; row++) {
            let outRow = outIndex.get(firstKey[row], secondKey[row])
            if (outRow === undefined) {
                outRow = ownerFrame.length
                outIndex.set(firstKey[row], secondKey[row], outRow)
                ownerFrame.push(frameIndex)
                ownerRow.push(row)
            }
            outRows[row] = outRow
        }
        return outRows
    })

    return { outRowsByFrame, ownerFrame, ownerRow }
}

/**
 * Inverts `inputRow -> outRow` into `outRow -> firstMatchingInputRow` (-1 if
 * absent), logging once per duplicate key in the frame.
 */
const invertToFirstRowPerKey = (
    outRows: Int32Array,
    numOutRows: number
): Int32Array => {
    const rows = new Int32Array(numOutRows).fill(-1)
    // Allocated lazily since duplicate keys in a single frame are rare
    let duplicateOutRows: Set<number> | undefined
    for (let row = 0; row < outRows.length; row++) {
        const outRow = outRows[row]
        if (rows[outRow] === -1) {
            rows[outRow] = row
        } else {
            duplicateOutRows ??= new Set()
            if (!duplicateOutRows.has(outRow)) {
                duplicateOutRows.add(outRow)
                logDuplicateJoinKey()
            }
        }
    }
    return rows
}

/** Keeps the first row for each distinct key, logging duplicates once per key */
const deduplicateOnKey = (frame: Frame, key: PairKey): Frame => {
    const columns = getPairKeyColumns(frame, key)
    if (!columns) return EMPTY_FRAME

    const [firstKey, secondKey] = columns
    const seen = new PairMap<number>()
    const keptRows: number[] = []
    let duplicateRows: Set<number> | undefined

    for (let row = 0; row < frame.numRows; row++) {
        const existing = seen.get(firstKey[row], secondKey[row])
        if (existing === undefined) {
            seen.set(firstKey[row], secondKey[row], row)
            keptRows.push(row)
        } else {
            duplicateRows ??= new Set()
            if (!duplicateRows.has(existing)) {
                duplicateRows.add(existing)
                logDuplicateJoinKey()
            }
        }
    }

    if (keptRows.length === frame.numRows)
        return { ...frame, uniqueKey: key.join(",") }

    return {
        columns: frame.columns.map(({ def, values }) => ({
            def,
            values: keptRows.map((row) => values[row]),
        })),
        numRows: keptRows.length,
        uniqueKey: key.join(","),
    }
}

// ---------------------------------------------------------------------------
// Fallback matching
// ---------------------------------------------------------------------------

interface FallbackMatcher {
    match(baseRow: number): number | undefined
}

/**
 * Creates a lazy lookup from `baseFrame` rows to `otherFrame` rows on `key`.
 *
 * The index is built on first use (so lower-priority fallbacks cost nothing
 * when higher-priority ones match everything) and caches the previous lookup
 * because consecutive base rows usually share their fallback key (e.g. all days
 * of one year for one entity).
 */
const createFallbackMatcher = (
    baseFrame: Frame,
    otherFrame: Frame,
    key: JoinKey
): FallbackMatcher | undefined =>
    key.length === 1
        ? createSingleKeyMatcher(baseFrame, otherFrame, key[0])
        : createPairKeyMatcher(baseFrame, otherFrame, key)

const createSingleKeyMatcher = (
    baseFrame: Frame,
    otherFrame: Frame,
    slug: ColumnSlug
): FallbackMatcher | undefined => {
    const baseValues = findColumn(baseFrame, slug)?.values
    const otherValues = findColumn(otherFrame, slug)?.values
    if (!baseValues || !otherValues) return undefined

    let index: Map<CoreValueType, number> | undefined
    let hasCached = false
    let cachedKey: CoreValueType
    let cachedRow: number | undefined

    return {
        match(baseRow: number): number | undefined {
            const keyValue = baseValues[baseRow]
            if (hasCached && keyValue === cachedKey) return cachedRow

            if (!index) {
                index = new Map()
                // Later rows overwrite earlier ones: the last match wins
                for (let row = 0; row < otherFrame.numRows; row++)
                    index.set(otherValues[row], row)
            }

            cachedKey = keyValue
            cachedRow = index.get(keyValue)
            hasCached = true
            return cachedRow
        },
    }
}

const createPairKeyMatcher = (
    baseFrame: Frame,
    otherFrame: Frame,
    key: PairKey
): FallbackMatcher | undefined => {
    const baseColumns = getPairKeyColumns(baseFrame, key)
    const otherColumns = getPairKeyColumns(otherFrame, key)
    if (!baseColumns || !otherColumns) return undefined
    const [baseFirst, baseSecond] = baseColumns
    const [otherFirst, otherSecond] = otherColumns

    let index: PairMap<number> | undefined
    let hasCached = false
    let cachedFirst: CoreValueType
    let cachedSecond: CoreValueType
    let cachedRow: number | undefined

    return {
        match(baseRow: number): number | undefined {
            const first = baseFirst[baseRow]
            const second = baseSecond[baseRow]
            if (hasCached && first === cachedFirst && second === cachedSecond)
                return cachedRow

            if (!index) {
                index = new PairMap()
                // Later rows overwrite earlier ones: the last match wins
                for (let row = 0; row < otherFrame.numRows; row++)
                    index.set(otherFirst[row], otherSecond[row], row)
            }

            cachedFirst = first
            cachedSecond = second
            cachedRow = index.get(first, second)
            hasCached = true
            return cachedRow
        },
    }
}

const matchRowsByFallbacks = (
    baseFrame: Frame,
    otherFrame: Frame,
    fallbackKeys: JoinKey[]
): Int32Array => {
    const matchers = fallbackKeys
        .map((key) => createFallbackMatcher(baseFrame, otherFrame, key))
        .filter((matcher): matcher is FallbackMatcher => matcher !== undefined)

    const matchedRows = new Int32Array(baseFrame.numRows).fill(-1)
    if (matchers.length === 0) return matchedRows

    for (let baseRow = 0; baseRow < baseFrame.numRows; baseRow++) {
        for (const matcher of matchers) {
            const row = matcher.match(baseRow)
            if (row !== undefined) {
                matchedRows[baseRow] = row
                break
            }
        }
    }
    return matchedRows
}
