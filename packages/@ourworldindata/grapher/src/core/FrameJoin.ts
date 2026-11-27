/**
 * Frames are a lightweight columnar data structure, and they have less overhead
 * a full OwidTable.
 *
 * There are also methods in here that can efficiently join frames on shared keys
 * without constructing full OwidTables.
 *
 * Performance is key here, and all operations in here should be optimized.
 */

import { ColumnSlug } from "@ourworldindata/utils"
import {
    CoreValueType,
    OwidColumnDef,
    OwidEntityIdColumnDef,
    OwidTableSlugs,
    TimeInterval,
} from "@ourworldindata/types"
import { ErrorValueTypes, OwidTable } from "@ourworldindata/core-table"

export interface FrameColumn {
    def: OwidColumnDef
    values: CoreValueType[]
}

export interface Frame {
    /** In output order */
    columns: FrameColumn[]
    numRows: number
    /** Set when we know that every row has distinct values for this key; e.g. "entityId,year" */
    uniqueKey?: string
}

/**
 * A 3-column frame representing a single indicator: `(entityId, time, value)`.
 * Having a fixed shape lets `fullJoin` access the key and value columns
 * directly without generic slug lookups.
 */
export interface IndicatorFrame {
    entityIds: CoreValueType[]
    times: number[]
    timeDef: OwidColumnDef
    valueColumn: FrameColumn
    interval: TimeInterval
}

export type PairKey = readonly [ColumnSlug, ColumnSlug]
export type JoinKey = readonly [ColumnSlug] | PairKey

export const EMPTY_FRAME: Frame = { columns: [], numRows: 0 }

export const indicatorFrameToFrame = (indicator: IndicatorFrame): Frame => ({
    columns: [
        { def: OwidEntityIdColumnDef, values: indicator.entityIds },
        { def: indicator.timeDef, values: indicator.times },
        indicator.valueColumn,
    ],
    numRows: indicator.entityIds.length,
})

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
// Full outer join (3-column IndicatorFrames sharing the same time bucket)
// ---------------------------------------------------------------------------

/**
 * Full outer join of 3-column `IndicatorFrame`s on `(time, entityId)`.
 *
 * Output columns are `[entityId, time, ...values]`, with
 * `ErrorValueTypes.NoMatchingValueAfterJoin` where an indicator has no row for
 * a `(time, entityId)` key.
 */
export const fullJoin = (indicators: IndicatorFrame[]): Frame => {
    if (indicators.length === 0) return EMPTY_FRAME
    if (indicators.length === 1) return indicatorFrameToFrame(indicators[0])

    const [first] = indicators
    const uniqueKey = `${OwidTableSlugs.EntityId},${first.timeDef.slug}`

    // Fast path: for multi-indicator charts, indicators often come from the
    // same dataset and share the exact same unique keys in the same order.
    // Reuse all column arrays directly without copying.
    if (
        haveIdenticalKeys(indicators) &&
        areKeysUniqueByRun(first.entityIds, first.times)
    )
        return joinAlignedFrames(indicators, uniqueKey)

    // Pass 1: collect every distinct (time, entityId) key in indicator order
    const { outEntityIds, outTimes, outRowsByIndicator, firstOwnsAllRows } =
        collectUniqueKeys(indicators)
    const numOutRows = outTimes.length

    // Pass 2: align each indicator's value column to the output row order
    const valueColumns: FrameColumn[] = indicators.map(
        ({ valueColumn }, index) => {
            // Fast path: if every key appeared uniquely in indicator 0, its
            // value array is already in output order and can be reused as-is.
            if (index === 0 && firstOwnsAllRows)
                return {
                    def: { ...valueColumn.def },
                    values: valueColumn.values,
                }

            const firstRowPerOutRow = invertToFirstRowPerKey(
                outRowsByIndicator[index],
                numOutRows
            )
            return {
                def: { ...valueColumn.def },
                values: gatherColumnValues(
                    valueColumn.values,
                    firstRowPerOutRow
                ),
            }
        }
    )

    return {
        columns: [
            { def: OwidEntityIdColumnDef, values: outEntityIds },
            { def: { ...first.timeDef }, values: outTimes },
            ...valueColumns,
        ],
        numRows: numOutRows,
        uniqueKey,
    }
}

/** Zero-copy join when all indicators share identical unique keys in the same order */
const joinAlignedFrames = (
    indicators: IndicatorFrame[],
    uniqueKey: string
): Frame => {
    const [first] = indicators
    return {
        columns: [
            { def: OwidEntityIdColumnDef, values: first.entityIds },
            { def: { ...first.timeDef }, values: first.times },
            ...indicators.map(({ valueColumn }) => ({
                def: { ...valueColumn.def },
                values: valueColumn.values,
            })),
        ],
        numRows: first.entityIds.length,
        uniqueKey,
    }
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
 * Caches the last outer lookup so runs sharing the first key (e.g. all times
 * of one entity) skip the outer Map lookup.
 */
class PairMap<T> {
    private readonly outer = new Map<CoreValueType, Map<CoreValueType, T>>()
    private hasCachedOuter = false
    private cachedOuterKey: CoreValueType | undefined
    private cachedInner: Map<CoreValueType, T> | undefined

    private getInner(first: CoreValueType): Map<CoreValueType, T> | undefined {
        if (this.hasCachedOuter && first === this.cachedOuterKey)
            return this.cachedInner
        const inner = this.outer.get(first)
        this.cachedOuterKey = first
        this.cachedInner = inner
        this.hasCachedOuter = true
        return inner
    }

    get(first: CoreValueType, second: CoreValueType): T | undefined {
        return this.getInner(first)?.get(second)
    }

    set(first: CoreValueType, second: CoreValueType, value: T): void {
        let inner = this.getInner(first)
        if (inner === undefined) {
            inner = new Map<CoreValueType, T>()
            this.outer.set(first, inner)
            this.cachedOuterKey = first
            this.cachedInner = inner
            this.hasCachedOuter = true
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

/** Whether every indicator has the same `(time, entityId)` keys in the same order */
const haveIdenticalKeys = (indicators: IndicatorFrame[]): boolean => {
    const [first] = indicators
    const numRows = first.entityIds.length
    for (let i = 1; i < indicators.length; i++) {
        const other = indicators[i]
        if (other.entityIds.length !== numRows) return false
        if (other.times !== first.times) {
            for (let row = 0; row < numRows; row++)
                if (other.times[row] !== first.times[row]) return false
        }
        if (other.entityIds !== first.entityIds) {
            for (let row = 0; row < numRows; row++)
                if (other.entityIds[row] !== first.entityIds[row]) return false
        }
    }
    return true
}

/**
 * Cheap check that no two rows share an `(entity, time)` key: succeeds if each
 * entity's rows form a single contiguous run with strictly increasing times
 * (the usual layout of our data). Returning false only means uniqueness wasn't
 * proven cheaply, not that duplicates definitely exist.
 */
const areKeysUniqueByRun = (
    entities: readonly CoreValueType[],
    times: readonly CoreValueType[]
): boolean => {
    const seenEntities = new Set<number>()
    for (let row = 0; row < entities.length; row++) {
        const entity = entities[row]
        const time = times[row]
        if (typeof entity !== "number" || typeof time !== "number") return false
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

const isUniqueOnKey = (frame: Frame, key: PairKey): boolean => {
    if (frame.uniqueKey === key.join(",")) return true
    const columns = getPairKeyColumns(frame, key)
    if (!columns) return false
    return areKeysUniqueByRun(columns[0], columns[1])
}

/**
 * Collects all distinct `(time, entityId)` keys across `indicators` in order
 * and maps each indicator's input rows to their output row index.
 */
const collectUniqueKeys = (
    indicators: IndicatorFrame[]
): {
    outEntityIds: CoreValueType[]
    outTimes: number[]
    outRowsByIndicator: Int32Array[]
    firstOwnsAllRows: boolean
} => {
    const outIndex = new PairMap<number>()
    const outEntityIds: CoreValueType[] = []
    const outTimes: number[] = []
    let firstHadUniqueKeys = false

    const outRowsByIndicator = indicators.map((indicator, indicatorIndex) => {
        const { times, entityIds } = indicator
        const numRows = entityIds.length
        const outRows = new Int32Array(numRows)
        for (let row = 0; row < numRows; row++) {
            const time = times[row]
            const entityId = entityIds[row]
            // Key by (entityId, time): data is grouped by entity, so consecutive
            // rows hit the same inner Map and daily data allocates far fewer Maps
            let outRow = outIndex.get(entityId, time)
            if (outRow === undefined) {
                outRow = outTimes.length
                outIndex.set(entityId, time, outRow)
                outTimes.push(time)
                outEntityIds.push(entityId)
            }
            outRows[row] = outRow
        }
        if (indicatorIndex === 0)
            firstHadUniqueKeys = outTimes.length === numRows
        return outRows
    })

    const firstOwnsAllRows =
        firstHadUniqueKeys && outTimes.length === indicators[0].entityIds.length
    return { outEntityIds, outTimes, outRowsByIndicator, firstOwnsAllRows }
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
