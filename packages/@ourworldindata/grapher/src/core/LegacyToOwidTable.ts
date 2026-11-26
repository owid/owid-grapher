// Turns the variable data + metadata we fetch from our data API into the
// single OwidTable that a chart renders from.
//
// Performance notes: this runs on every chart load and its input can be
// hundreds of thousands of rows (daily indicators), so the per-variable tables
// and the joins between them are built on plain column arrays. Only the final
// result becomes an OwidTable, constructed from typed values so it never needs
// to parse anything.

import * as _ from "lodash-es"
import {
    AnnotationTimeScope,
    ColumnTypeNames,
    CoreValueType,
    EntityName,
    ErrorValue,
    IndicatorAnnotation,
    IndicatorDimensionInterface,
    OwidChartDimensionInterface,
    OwidColumnDef,
    OwidTableSlugs,
    OwidVariableAnnotation,
    OwidVariableDimensions,
    OwidVariableDisplayConfigInterface,
    SelectedEntityColors,
    StandardOwidColumnDefs,
    Time,
    TimeInterval,
    isIndicatorDimension,
} from "@ourworldindata/types"
import {
    ErrorValueTypes,
    OwidTable,
    makeOriginalTimeSlugFromColumnSlug,
} from "@ourworldindata/core-table"
import {
    ColumnSlug,
    EPOCH_DATE,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableDataMetadataDimensions,
    OwidVariableType,
    OwidVariableWithSource,
    OwidVariableWithSourceAndDimension,
    convertDateToDaysSinceEpoch,
    dayjs,
    diffDatesInDays,
    epochDate,
    findClosestTimeIndex,
    findFinestCommonTimeInterval,
    getTimeInterval,
    getYearFromISOStringAndDayOffset,
    isSubYearly,
    snapToIntervalStart,
    trimObject,
} from "@ourworldindata/utils"
import { isContinentsVariableId } from "./GrapherConstants"
import { getIndicatorColumnSlug } from "../chart/ChartDimension.js"
import { mergeDisplayIntoDef } from "./applyDisplayAndConversionFactor.js"

// ---------------------------------------------------------------------------
// Frames: a lightweight column store used while assembling the table
// ---------------------------------------------------------------------------

interface FrameColumn {
    def: OwidColumnDef
    values: CoreValueType[]
}

interface Frame {
    /** In output order */
    columns: FrameColumn[]
    numRows: number
    /** Set when every row is known to have a distinct value for these key columns */
    uniqueKey?: string
}

const EMPTY_FRAME: Frame = { columns: [], numRows: 0 }

const findColumn = (frame: Frame, slug: ColumnSlug): FrameColumn | undefined =>
    frame.columns.find((column) => column.def.slug === slug)

const frameToTable = (frame: Frame): OwidTable =>
    new OwidTable(
        [],
        frame.columns.map(({ def, values }) => ({ ...def, values }))
    )

interface VariableFrame {
    frame: Frame
    interval: TimeInterval
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export const legacyToOwidTableAndDimensions = (
    json: MultipleOwidVariableDataDimensionsMap,
    dimensions: OwidChartDimensionInterface[],
    selectedEntityColors: SelectedEntityColors | undefined
): OwidTable => {
    const entityLookup = makeEntityLookup(json)

    // One column per unique [variable, targetTime] pair, so a variable can
    // contribute several columns
    const indicatorDimensions = _.uniqBy(
        dimensions.filter(isIndicatorDimension),
        getIndicatorColumnSlug
    )

    const yearFrames: VariableFrame[] = []
    const dayFrames: VariableFrame[] = []
    // Variables pinned to a target time; joined on entity only
    const targetTimeFrames: Frame[] = []

    for (const dimension of indicatorDimensions) {
        const variable = json.get(dimension.variableId)
        // Shouldn't happen, but does when adding dimensions in the chart editor
        if (!variable) continue

        const variableFrame = buildVariableFrame(
            variable,
            dimension,
            entityLookup
        )
        const { targetYear } = dimension
        if (typeof targetYear === "number")
            targetTimeFrames.push(
                pinToTargetTime(variableFrame.frame, targetYear)
            )
        else if (isSubYearly(variableFrame.interval))
            dayFrames.push(variableFrame)
        else yearFrames.push(variableFrame)
    }

    // Day-based variables are joined among themselves on day+entity first,
    // and day+entity then becomes the primary index of the final table. Year
    // based variables are then joined in, looking up each row by
    // day+entity, then year+entity (the year being derived from the day),
    // then entity alone. The entity-only fallback keeps variables like
    // continents, which only have values for 2015, attached to every day.
    //
    // A caveat of making day+entity the primary index is that entities that
    // only occur in year-based variables are dropped (e.g. Antarctica from the
    // continents variable, if no daily variable has data for it).
    const joinedByDay = fullJoin(
        dayFrames.map((v) => v.frame),
        [OwidTableSlugs.Day, OwidTableSlugs.EntityId]
    )

    let joined: Frame
    let primaryTimeSlug: OwidTableSlugs.Day | OwidTableSlugs.Year
    if (yearFrames.length > 0 && dayFrames.length > 0) {
        // Join each year table separately, so that each gets its own
        // fallback lookups
        joined = fullJoin(
            [
                withYearDerivedFromDay(joinedByDay),
                ...yearFrames.map((v) => v.frame),
            ],
            [OwidTableSlugs.Day, OwidTableSlugs.EntityId],
            [
                [OwidTableSlugs.Year, OwidTableSlugs.EntityId],
                [OwidTableSlugs.EntityId],
            ]
        )
        primaryTimeSlug = OwidTableSlugs.Day
    } else if (yearFrames.length > 0) {
        joined = fullJoin(
            yearFrames.map((v) => v.frame),
            [OwidTableSlugs.Year, OwidTableSlugs.EntityId]
        )
        primaryTimeSlug = OwidTableSlugs.Year
    } else {
        joined = joinedByDay
        primaryTimeSlug = OwidTableSlugs.Day
    }

    if (targetTimeFrames.length > 0)
        joined = fullJoin(
            [joined, ...targetTimeFrames],
            [primaryTimeSlug, OwidTableSlugs.EntityId],
            [[OwidTableSlugs.EntityId]]
        )

    // A bucket can hold several intervals (e.g. a daily and a monthly
    // indicator both live in the day bucket), but the joined table has a
    // single time column, which should be tagged with the finest of them
    joined = withFinestTimeColumnInterval(joined, dayFrames, OwidTableSlugs.Day)
    joined = withFinestTimeColumnInterval(
        joined,
        yearFrames,
        OwidTableSlugs.Year
    )

    // Inject the canonical "time" column, e.g. used for the timeline
    const timeSource =
        findColumn(joined, OwidTableSlugs.Day) ??
        findColumn(joined, OwidTableSlugs.Year)
    const extraColumns: FrameColumn[] = []
    if (timeSource)
        extraColumns.push({
            def: {
                ...timeSource.def,
                slug: OwidTableSlugs.Time,
                name: OwidTableSlugs.Time,
            },
            values: timeSource.values,
        })

    if (!_.isEmpty(selectedEntityColors))
        extraColumns.push(
            makeEntityColorColumn(
                findColumn(joined, OwidTableSlugs.EntityName)?.values ?? [],
                selectedEntityColors
            )
        )

    return frameToTable({
        columns: [...joined.columns, ...extraColumns],
        numRows: joined.numRows,
    })
}

/** Adds the entity color column that applies a config's `selectedEntityColors` */
export const appendSelectedEntityColors = (
    table: OwidTable,
    selectedEntityColors: SelectedEntityColors | undefined
): OwidTable => {
    if (_.isEmpty(selectedEntityColors)) return table
    const { def, values } = makeEntityColorColumn(
        table.entityNameColumn.valuesIncludingErrorValues,
        selectedEntityColors
    )
    return table.appendColumns([{ ...def, values }])
}

const makeEntityColorColumn = (
    entityNames: readonly CoreValueType[],
    selectedEntityColors: SelectedEntityColors | undefined
): FrameColumn => ({
    def: {
        slug: OwidTableSlugs.EntityColor,
        name: OwidTableSlugs.EntityColor,
        type: ColumnTypeNames.Color,
    },
    values: entityNames.map(
        (entityName): string | ErrorValue =>
            (entityName
                ? selectedEntityColors?.[entityName as EntityName]
                : undefined) ?? ErrorValueTypes.UndefinedButShouldBeString
    ),
})

// ---------------------------------------------------------------------------
// Per-variable frames
// ---------------------------------------------------------------------------

interface EntityInfo {
    name: CoreValueType
    code: CoreValueType
}

/**
 * Resolves entity ids to their (already parsed) name and code, caching per id.
 *
 * Data comes from S3 and metadata from MySQL, so an id can be missing from the
 * metadata; such entities are named after their id.
 */
const makeEntityLookup = (
    json: MultipleOwidVariableDataDimensionsMap
): ((id: number) => EntityInfo) => {
    // Later variables win, matching the previous object-based lookup
    const metaById = new Map<string, { name?: string; code?: string }>()
    for (const variable of json.values())
        for (const entity of variable.metadata.dimensions.entities.values)
            metaById.set(entity.id.toString(), entity)

    const cache = new Map<number, EntityInfo>()
    return (id: number): EntityInfo => {
        let info = cache.get(id)
        if (info === undefined) {
            const meta = metaById.get(String(id))
            info = {
                name: parseString(meta?.name ?? id.toString()),
                code: parseString(meta?.code),
            }
            cache.set(id, info)
        }
        return info
    }
}

const buildVariableFrame = (
    variable: OwidVariableDataMetadataDimensions,
    dimension: IndicatorDimensionInterface,
    lookupEntity: (id: number) => EntityInfo
): VariableFrame => {
    const { metadata, data } = variable
    const interval = getTimeInterval(metadata.display)
    const timeDef = TIME_COLUMN_DEF_BY_INTERVAL[interval]

    const valueSlug = getIndicatorColumnSlug(dimension)
    let valueDef: OwidColumnDef = {
        ...columnDefFromOwidVariable(metadata),
        slug: valueSlug,
        // Database columns can contain mixed types, so we don't parse values
        skipParsing: true,
    }
    valueDef.display = trimObject(valueDef.display)
    if (dimension.targetYear !== undefined)
        valueDef.targetTime = dimension.targetYear

    const display = trimObject({
        conversionFactor: metadata.display?.conversionFactor,
        ...trimObject(dimension.display ?? {}),
    }) as OwidVariableDisplayConfigInterface
    let values: CoreValueType[] = data.values ?? []
    if (!_.isEmpty(display)) {
        valueDef = mergeDisplayIntoDef(valueDef, display)
        // Scale before joining, so values repeated across joined rows are
        // only converted once
        const { conversionFactor } = display
        if (conversionFactor !== undefined && conversionFactor !== 1)
            values = values.map((value) =>
                typeof value === "number" ? value * conversionFactor : value
            )
    }

    const entityIds = data.entities ?? []
    const numRows = entityIds.length
    const parsedIds: CoreValueType[] = []
    const names: CoreValueType[] = []
    const codes: CoreValueType[] = []
    for (let i = 0; i < numRows; i++) {
        const id = entityIds[i]
        const entity = lookupEntity(id)
        parsedIds.push(parseNumber(id))
        names.push(entity.name)
        codes.push(entity.code)
    }

    return {
        interval,
        frame: {
            columns: [
                { def: StandardOwidColumnDefs[0], values: names },
                { def: StandardOwidColumnDefs[1], values: parsedIds },
                { def: StandardOwidColumnDefs[2], values: codes },
                {
                    def: timeDef,
                    values: timeValuesFromOwidVariable(
                        metadata,
                        data.years ?? []
                    ),
                },
                { def: valueDef, values },
            ],
            numRows,
        },
    }
}

/**
 * Keeps only the rows at (or, given the value column's tolerance, closest to)
 * the target time, and swaps the time column for an "originalTime" column, so
 * that the frame can be joined on entity alone.
 */
const pinToTargetTime = (frame: Frame, targetTime: Time): Frame => {
    const [nameColumn, , , timeColumn, valueColumn] = frame.columns
    const times = timeColumn.values as number[]
    const tolerance =
        valueColumn.def.display?.tolerance ?? valueColumn.def.tolerance ?? 0

    let keepRow: (row: number) => boolean
    if (tolerance === 0) {
        keepRow = (row): boolean => times[row] === targetTime
    } else {
        // For each entity, find the row closest to the target time
        const rowsByEntity = new Map<CoreValueType, number[]>()
        for (let row = 0; row < frame.numRows; row++) {
            const name = nameColumn.values[row]
            const rows = rowsByEntity.get(name)
            if (rows) rows.push(row)
            else rowsByEntity.set(name, [row])
        }
        const keptRows = new Set<number>()
        for (const rows of rowsByEntity.values()) {
            const sortedRows = rows.sort((a, b) => times[a] - times[b])
            const index = findClosestTimeIndex(
                sortedRows.map((row) => times[row]),
                targetTime,
                tolerance
            )
            if (index !== undefined) keptRows.add(sortedRows[index])
        }
        keepRow = (row): boolean => keptRows.has(row)
    }

    const rows: number[] = []
    for (let row = 0; row < frame.numRows; row++)
        if (keepRow(row)) rows.push(row)
    const take = (values: CoreValueType[]): CoreValueType[] =>
        rows.map((row) => values[row])

    const pick = (column: FrameColumn): FrameColumn => ({
        def: column.def,
        values: take(column.values),
    })
    return {
        columns: [
            ...frame.columns
                .filter((column) => column !== timeColumn)
                .map(pick),
            {
                def: {
                    ...timeColumn.def,
                    slug: makeOriginalTimeSlugFromColumnSlug(
                        valueColumn.def.slug
                    ),
                    display: { includeInTable: false },
                    derivedFrom: {
                        columnSlug: valueColumn.def.slug,
                        relationship: "originalTime",
                    },
                },
                values: take(timeColumn.values),
            },
        ],
        numRows: rows.length,
    }
}

/** Appends a year column, derived from the frame's day column */
const withYearDerivedFromDay = (frame: Frame): Frame => {
    const dayColumn = findColumn(frame, OwidTableSlugs.Day)
    if (!dayColumn) return frame

    const yearByDay = new Map<number, number>()
    const years = dayColumn.values.map((day) => {
        let year = yearByDay.get(day as number)
        if (year === undefined) {
            year = getYearFromISOStringAndDayOffset(EPOCH_DATE, day as number)
            yearByDay.set(day as number, year)
        }
        return year
    })

    return {
        columns: [
            ...frame.columns,
            // Deliberately untyped, matching what this column always was
            {
                def: { slug: OwidTableSlugs.Year, name: OwidTableSlugs.Year },
                values: years,
            },
        ],
        numRows: frame.numRows,
        uniqueKey: frame.uniqueKey,
    }
}

/**
 * Relabels the joined time column with the finest interval that can represent
 * every joined variable's times
 */
const withFinestTimeColumnInterval = (
    frame: Frame,
    variableFrames: VariableFrame[],
    slug: OwidTableSlugs.Day | OwidTableSlugs.Year
): Frame => {
    const intervals = variableFrames.map((v) => v.interval)
    if (new Set(intervals).size < 2) return frame
    const timeDef =
        TIME_COLUMN_DEF_BY_INTERVAL[findFinestCommonTimeInterval(intervals)]
    return {
        ...frame,
        columns: frame.columns.map((column) =>
            column.def.slug === slug
                ? { ...column, def: { ...column.def, ...timeDef } }
                : column
        ),
    }
}

// ---------------------------------------------------------------------------
// Joining
// ---------------------------------------------------------------------------

type JoinKey = [ColumnSlug] | [ColumnSlug, ColumnSlug]

/**
 * A map keyed by the values of one or two columns. Nesting maps avoids
 * building a string key for every row.
 */
class KeyMap<T> {
    private readonly map = new Map<unknown, any>()
    constructor(private readonly arity: 1 | 2) {}

    get(a: unknown, b: unknown): T | undefined {
        if (this.arity === 1) return this.map.get(a)
        return this.map.get(a)?.get(b)
    }

    set(a: unknown, b: unknown, value: T): void {
        if (this.arity === 1) {
            this.map.set(a, value)
            return
        }
        let inner = this.map.get(a)
        if (inner === undefined) {
            inner = new Map<unknown, T>()
            this.map.set(a, inner)
        }
        inner.set(b, value)
    }
}

const keyColumns = (
    frame: Frame,
    key: JoinKey
): [CoreValueType[], CoreValueType[]] | undefined => {
    const columns = key.map((slug) => findColumn(frame, slug)?.values)
    if (columns.some((values) => values === undefined)) return undefined
    // For one-column keys, the second key part is always undefined
    return [columns[0]!, columns[1] ?? []]
}

/**
 * Full outer join of the given frames on the `key` columns.
 *
 * Columns that all frames have (the key columns, but also entityName and
 * entityCode) end up once in the result, taken from the first frame that has
 * a row for the key; we assume they agree across frames. All other columns are
 * copied over from their frame.
 *
 * Rows are only enumerated from frames that have all key columns. When a frame
 * has no row for a key, the `fallbackKeys` are tried in turn, using the values
 * of the first frame's row. This is how year-based variables are joined onto
 * a day-based index (by year+entity, then entity only). When several rows
 * match a fallback key, the last one is used, which is usually the most recent
 * time; a proper fix would be a time- and tolerance-aware join.
 */
const fullJoin = (
    frames: Frame[],
    key: JoinKey,
    fallbackKeys?: JoinKey[]
): Frame => {
    if (frames.length === 0) return EMPTY_FRAME
    // Not marked as unique: a single frame can have duplicate keys
    if (frames.length === 1) return frames[0]

    const uniqueKey = key.join(",")
    const [firstFrame] = frames

    // 1. Enumerate the unique keys in order of first appearance, and for each
    //    frame, find its first row for each of them.
    //    rowsByFrame[f][outRow]: the first row of frame f with the key, or -1
    let rowsByFrame: Int32Array[]
    // The frame (and its row) that a result row's shared columns are taken
    // from. Unset when the first frame owns every row, one row per key
    let owners: { frame: number[]; row: number[] } | undefined
    let numOutRows: number
    // Set when row i of every frame is row i of the result
    let allFramesAligned = false
    if (haveIdenticalKeys(frames, key) && isUniqueOnKey(firstFrame, key)) {
        // All frames list the same keys in the same order (e.g. indicators
        // from one dataset with the same coverage), so no lookups are needed
        numOutRows = firstFrame.numRows
        rowsByFrame = []
        allFramesAligned = true
    } else if (
        firstFrame.uniqueKey === uniqueKey &&
        frames.every((frame, f) => f === 0 || !keyColumns(frame, key))
    ) {
        // The first frame is the result of a previous join on this key, and no
        // other frame contributes keys, so the first frame's rows are the result
        numOutRows = firstFrame.numRows
        rowsByFrame = frames.map((_frame, f) =>
            f === 0
                ? Int32Array.from({ length: numOutRows }, (_, row) => row)
                : new Int32Array(numOutRows).fill(-1)
        )
    } else {
        const enumerated = enumerateKeys(frames, key, !!fallbackKeys)
        rowsByFrame = enumerated.rowsByFrame
        numOutRows = enumerated.ownerFrame.length
        // Owners are assigned in frame order, so if the last result row is
        // owned by the first frame, it owns all of them; and if it also has as
        // many rows as there are results, each of its rows has a distinct key
        const { ownerFrame, ownerRow } = enumerated
        const firstFrameOwnsAllRows =
            numOutRows === firstFrame.numRows &&
            (numOutRows === 0 || ownerFrame[numOutRows - 1] === 0)
        if (!firstFrameOwnsAllRows)
            owners = { frame: ownerFrame, row: ownerRow }
    }

    // 2. Columns shared by all frames are taken from the owner frame. Their
    //    order follows the last frame, as it always has
    const sharedSlugs = frames[frames.length - 1].columns
        .map((column) => column.def.slug)
        .filter((slug) => frames.every((frame) => findColumn(frame, slug)))
    const sharedSlugSet = new Set(sharedSlugs)

    const outColumns: FrameColumn[] = sharedSlugs.map((slug) => {
        const def = { ...findColumn(firstFrame, slug)!.def }
        if (!owners)
            return { def, values: findColumn(firstFrame, slug)!.values }
        const sources = frames.map((frame) => findColumn(frame, slug)!.values)
        const values: CoreValueType[] = []
        for (let outRow = 0; outRow < numOutRows; outRow++)
            values.push(sources[owners.frame[outRow]][owners.row[outRow]])
        return { def, values }
    })

    // 3. All other columns are looked up per frame, falling back to the
    //    fallback keys for result rows owned by the first frame
    const fallbackKeyValues = fallbackKeys?.map((fallbackKey) =>
        keyColumns(firstFrame, fallbackKey)
    )
    frames.forEach((frame, f) => {
        const valueColumns = frame.columns.filter(
            (column) => !sharedSlugSet.has(column.def.slug)
        )
        if (valueColumns.length === 0) return

        // The frame's rows are the result rows, so its columns carry over
        if (allFramesAligned || (f === 0 && !owners)) {
            for (const { def, values } of valueColumns)
                outColumns.push({ def: { ...def }, values })
            return
        }

        const rows = rowsByFrame[f]
        if (fallbackKeys && fallbackKeyValues)
            resolveFallbackRows(
                frame,
                rows,
                fallbackKeys,
                fallbackKeyValues,
                rowsByFrame[0],
                owners?.frame
            )

        for (const column of valueColumns) {
            const source = column.values
            const values: CoreValueType[] = []
            for (let outRow = 0; outRow < numOutRows; outRow++) {
                const row = rows[outRow]
                values.push(
                    row === -1
                        ? ErrorValueTypes.NoMatchingValueAfterJoin
                        : source[row]
                )
            }
            outColumns.push({ def: { ...column.def }, values })
        }
    })

    return { columns: outColumns, numRows: numOutRows, uniqueKey }
}

/** Whether every frame has the key columns, with the same values in the same order */
const haveIdenticalKeys = (frames: Frame[], key: JoinKey): boolean => {
    const firstColumns = keyColumns(frames[0], key)
    if (!firstColumns) return false
    const { numRows } = frames[0]
    for (let f = 1; f < frames.length; f++) {
        if (frames[f].numRows !== numRows) return false
        const columns = keyColumns(frames[f], key)
        if (!columns) return false
        for (let c = 0; c < key.length; c++) {
            const first = firstColumns[c]
            const other = columns[c]
            if (first === other) continue
            for (let row = 0; row < numRows; row++)
                if (other[row] !== first[row]) return false
        }
    }
    return true
}

/**
 * Whether no two rows of the frame share a key. Only proven cheaply: either
 * the frame came out of a join on this key, or (for a time + entity key) each
 * entity's rows form one run with strictly increasing times, which is how our
 * data is usually laid out. Returns false when it can't tell.
 */
const isUniqueOnKey = (frame: Frame, key: JoinKey): boolean => {
    if (frame.uniqueKey === key.join(",")) return true
    if (key.length !== 2 || key[1] !== OwidTableSlugs.EntityId) return false
    const columns = keyColumns(frame, key)
    if (!columns) return false
    const [times, entities] = columns
    const seenEntities = new Set<unknown>()
    for (let row = 0; row < frame.numRows; row++) {
        const time = times[row]
        const entity = entities[row]
        if (typeof time !== "number" || typeof entity !== "number") return false
        if (row > 0 && entity === entities[row - 1]) {
            if (!(time > (times[row - 1] as number))) return false
        } else {
            // A new run starts; the entity must not have had one before
            if (seenEntities.has(entity)) return false
            seenEntities.add(entity)
        }
    }
    return true
}

const enumerateKeys = (
    frames: Frame[],
    key: JoinKey,
    hasFallbackKeys: boolean
): { rowsByFrame: Int32Array[]; ownerFrame: number[]; ownerRow: number[] } => {
    const outIndex = new KeyMap<number>(key.length)
    const ownerFrame: number[] = []
    const ownerRow: number[] = []
    // outRowsByFrame[f][row]: the result row that a row of frame f maps to
    const outRowsByFrame = frames.map((frame, f) => {
        const columns = keyColumns(frame, key)
        // Without fallbacks every frame is expected to have the key
        if (!columns && !hasFallbackKeys)
            throw new Error(`Frame ${f} is missing join key columns`)
        if (!columns) return undefined
        const [a, b] = columns
        const outRows = new Int32Array(frame.numRows)
        for (let row = 0; row < frame.numRows; row++) {
            let outRow = outIndex.get(a[row], b[row])
            if (outRow === undefined) {
                outRow = ownerFrame.length
                outIndex.set(a[row], b[row], outRow)
                ownerFrame.push(f)
                ownerRow.push(row)
            }
            outRows[row] = outRow
        }
        return outRows
    })
    const numOutRows = ownerFrame.length

    let numDuplicateHits = 0
    const rowsByFrame = outRowsByFrame.map((outRows) => {
        const rows = new Int32Array(numOutRows).fill(-1)
        if (!outRows) return rows
        // Mark the first row per key; count keys hit more than once
        const hitCount = new Uint8Array(numOutRows)
        for (let row = 0; row < outRows.length; row++) {
            const outRow = outRows[row]
            if (rows[outRow] === -1) rows[outRow] = row
            if (hitCount[outRow] === 1) numDuplicateHits++
            if (hitCount[outRow] < 2) hitCount[outRow]++
        }
        return rows
    })
    // This should be rare. We then use the first matching row, which can be
    // the wrong one, so leave a hint for debugging
    for (let i = 0; i < numDuplicateHits; i++)
        console.error(
            "Found more than one matching row for a join key in a frame"
        )

    return { rowsByFrame, ownerFrame, ownerRow }
}

/** Fills in (in place) the rows of a frame that are found via fallback keys */
const resolveFallbackRows = (
    frame: Frame,
    rows: Int32Array,
    fallbackKeys: JoinKey[],
    fallbackKeyValues: ([CoreValueType[], CoreValueType[]] | undefined)[],
    firstFrameRows: Int32Array,
    /** Undefined when the first frame owns every result row */
    ownerFrame: number[] | undefined
): void => {
    // Built lazily, since most frames match on the primary key
    const indexes: (KeyMap<number> | null | undefined)[] = []
    const getIndex = (k: number): KeyMap<number> | null => {
        let index = indexes[k]
        if (index === undefined) {
            const columns = keyColumns(frame, fallbackKeys[k])
            if (!columns) index = null
            else {
                index = new KeyMap<number>(fallbackKeys[k].length)
                const [a, b] = columns
                // Later rows overwrite earlier ones: the last match wins
                for (let row = 0; row < frame.numRows; row++)
                    index.set(a[row], b[row], row)
            }
            indexes[k] = index
        }
        return index
    }

    // Consecutive rows usually share their fallback key (e.g. the days of a
    // year for one entity), so remember the last lookup per fallback key
    const lastA: unknown[] = []
    const lastB: unknown[] = []
    const lastRow: (number | undefined)[] = []

    for (let outRow = 0; outRow < rows.length; outRow++) {
        if (rows[outRow] !== -1) continue
        if (ownerFrame && ownerFrame[outRow] !== 0) continue
        const firstFrameRow = firstFrameRows[outRow]
        for (let k = 0; k < fallbackKeys.length; k++) {
            const keyValues = fallbackKeyValues[k]
            if (!keyValues) continue
            const a = keyValues[0][firstFrameRow]
            const b = keyValues[1][firstFrameRow]
            let row: number | undefined
            if (k in lastRow && lastA[k] === a && lastB[k] === b)
                row = lastRow[k]
            else {
                const index = getIndex(k)
                if (!index) continue
                row = index.get(a, b)
                lastA[k] = a
                lastB[k] = b
                lastRow[k] = row
            }
            if (row !== undefined) {
                rows[outRow] = row
                break
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Parsing, matching what OwidTable does for untyped input
// ---------------------------------------------------------------------------

const parseString = (value: unknown): CoreValueType => {
    if (value === null) return ErrorValueTypes.NullButShouldBeString
    if (value === undefined) return ErrorValueTypes.UndefinedButShouldBeString
    return String(value)
}

const parseNumber = (value: unknown): CoreValueType => {
    if (typeof value === "number" && !Number.isNaN(value)) return value
    if (value === null) return ErrorValueTypes.NullButShouldBeNumber
    if (value === undefined) return ErrorValueTypes.UndefinedButShouldBeNumber
    if (value === "") return ErrorValueTypes.BlankButShouldBeNumber
    if (Number.isNaN(Number(value))) return ErrorValueTypes.NaNButShouldBeNumber
    const parsed = parseFloat(String(value))
    return Number.isNaN(parsed)
        ? ErrorValueTypes.NotAParseableNumberButShouldBeNumber
        : parsed
}

const parseTime = (value: number): number =>
    Number.isInteger(value) ? value : parseInt(String(value))

// ---------------------------------------------------------------------------
// Time columns
// ---------------------------------------------------------------------------

// Maps each time interval to the time column it produces. Sub-yearly intervals
// all share the `day` slug (days-since-epoch) so they join in the same bucket
const TIME_COLUMN_DEF_BY_INTERVAL: Record<TimeInterval, OwidColumnDef> = {
    [TimeInterval.Day]: {
        slug: OwidTableSlugs.Day,
        type: ColumnTypeNames.Day,
        name: "Day",
    },
    [TimeInterval.Week]: {
        slug: OwidTableSlugs.Day,
        type: ColumnTypeNames.Week,
        name: "Week",
    },
    [TimeInterval.Month]: {
        slug: OwidTableSlugs.Day,
        type: ColumnTypeNames.Month,
        name: "Month",
    },
    [TimeInterval.Quarter]: {
        slug: OwidTableSlugs.Day,
        type: ColumnTypeNames.Quarter,
        name: "Quarter",
    },
    [TimeInterval.Year]: {
        slug: OwidTableSlugs.Year,
        type: ColumnTypeNames.Year,
        name: "Year",
    },
    [TimeInterval.Decade]: {
        slug: OwidTableSlugs.Year,
        type: ColumnTypeNames.Decade,
        name: "Decade",
    },
}

const timeValuesFromOwidVariable = (
    metadata: OwidVariableWithSource,
    years: number[]
): number[] => {
    const { display } = metadata
    const interval = getTimeInterval(display)
    if (!isSubYearly(interval)) return years.map(parseTime)

    // Day-encoded values are relative to the variable's zeroDay; shift them
    // onto the shared EPOCH_DATE so that variables are comparable
    const zeroDay = display?.zeroDay
    const offset =
        zeroDay !== undefined && zeroDay !== EPOCH_DATE
            ? diffDatesInDays(dayjs.utc(zeroDay), epochDate())
            : 0

    // Snap sub-yearly values (except plain days) to the start of their
    // period, so that variables that pick different representative days for
    // the same period still align
    if (interval === TimeInterval.Day)
        return years.map((year) => parseTime(year + offset))
    return years.map((year) =>
        parseTime(snapToIntervalStart(year + offset, interval))
    )
}

// ---------------------------------------------------------------------------
// Column defs
// ---------------------------------------------------------------------------

const variableTypeToColumnType = (type: OwidVariableType): ColumnTypeNames => {
    switch (type) {
        case "ordinal":
            return ColumnTypeNames.Ordinal
        case "string":
            return ColumnTypeNames.String
        case "int":
            return ColumnTypeNames.Integer
        case "float":
            return ColumnTypeNames.Numeric
        case "mixed":
        default:
            return ColumnTypeNames.NumberOrString
    }
}

/** The sort order of an ordinal variable's categories, e.g. Low, Medium, High */
const getSortFromDimensions = (
    dimensions: OwidVariableDimensions
): string[] | undefined => {
    const sort = dimensions.values?.values
        ?.map((value) => value.name)
        .filter((name) => name !== undefined)
    return sort?.length ? sort : undefined
}

const columnDefFromOwidVariable = (
    variable: OwidVariableWithSourceAndDimension
): OwidColumnDef => {
    const { source, display } = variable
    const parsedType = variable.type
        ? variableTypeToColumnType(variable.type)
        : ColumnTypeNames.NumberOrString

    return {
        name: variable.name,
        slug: variable.id.toString(),
        unit: variable.unit,
        shortUnit: variable.shortUnit,
        description: variable.description,
        descriptionShort: variable.descriptionShort,
        descriptionProcessing: variable.descriptionProcessing,
        descriptionKey: variable.descriptionKey,
        descriptionFromProducer: variable.descriptionFromProducer,
        coverage: variable.coverage,
        datasetId: variable.datasetId,
        datasetName: variable.datasetName,
        display,
        color: display?.color,
        nonRedistributable: variable.nonRedistributable,
        sourceLink: source?.link,
        sourceName: source?.name,
        dataPublishedBy: source?.dataPublishedBy,
        dataPublisherSource: source?.dataPublisherSource,
        retrievedDate: source?.retrievedDate,
        additionalInfo: source?.additionalInfo,
        timespan: variable.timespan,
        origins: variable.origins,
        annotations: parseIndicatorAnnotations(variable),
        presentation: variable.presentation,
        catalogPath: variable.catalogPath,
        updatePeriodDays: variable.updatePeriodDays,
        owidVariableId: variable.id,
        owidProcessingLevel: variable.processingLevel,
        owidSchemaVersion: variable.schemaVersion,
        // The Continents variable gets its own column type
        type: isContinentsVariableId(variable.id)
            ? ColumnTypeNames.Continent
            : parsedType,
        sort:
            parsedType === ColumnTypeNames.Ordinal
                ? getSortFromDimensions(variable.dimensions)
                : undefined,
        shortName: variable.shortName,
    }
}

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

const parseIndicatorAnnotations = (
    variable: OwidVariableWithSourceAndDimension
): IndicatorAnnotation[] | undefined => {
    const legacyAnnotations = parseLegacyEntityAnnotations(
        variable.display?.entityAnnotationsMap
    )
    if (!variable.annotations?.length && !legacyAnnotations.length)
        return undefined

    const annotations = (variable.annotations ?? []).flatMap((annotation) => {
        const parsed = parseIndicatorAnnotation(annotation, variable)
        return parsed ? [parsed] : []
    })
    return [...annotations, ...legacyAnnotations]
}

/**
 * Parses the legacy `entityAnnotationsMap`: one "Entity: text" line per
 * entity. A repeated entity keeps its last line.
 */
const parseLegacyEntityAnnotations = (
    entityAnnotationsMap: string | undefined
): IndicatorAnnotation[] => {
    const textByEntity = new Map<string, string>()
    for (const line of (entityAnnotationsMap ?? "").split("\n")) {
        const [entityName, ...words] = line.split(":")
        textByEntity.set(entityName.trim(), words.join(":").trim())
    }
    return [...textByEntity].flatMap(([entityName, text]) =>
        entityName && text
            ? [{ text, entityNames: [entityName], timeScope: "all" }]
            : []
    )
}

const parseIndicatorAnnotation = (
    annotation: OwidVariableAnnotation,
    variable: OwidVariableWithSourceAndDimension
): IndicatorAnnotation | undefined => {
    const { text, entities } = annotation
    const timeScope = parseTimeScope(annotation, variable)
    if (!timeScope) return undefined

    const [firstEntityName, ...otherEntityNames] = entities ?? []
    return firstEntityName === undefined
        ? { text, ...timeScope }
        : {
              text,
              entityNames: [firstEntityName, ...otherEntityNames],
              ...timeScope,
          }
}

const parseTimeScope = (
    annotation: OwidVariableAnnotation,
    variable: OwidVariableWithSourceAndDimension
): AnnotationTimeScope | undefined => {
    const drop = (reason: string): undefined => {
        console.warn(
            `Dropping annotation of variable ${variable.id} with ${reason}`
        )
        return undefined
    }

    if (annotation.time === undefined) {
        if (annotation.timeEnd === undefined) return { timeScope: "all" }
        return drop(`a timeEnd but no time: ${annotation.timeEnd}`)
    }

    const interval = getTimeInterval(variable.display)
    const time = parseAnnotationTime(annotation.time, interval)
    if (time === undefined) return drop(`an invalid time: ${annotation.time}`)

    if (annotation.timeEnd === undefined) return { timeScope: "point", time }
    const timeEnd = parseAnnotationTime(annotation.timeEnd, interval)
    if (timeEnd === undefined)
        return drop(`an invalid timeEnd: ${annotation.timeEnd}`)

    if (timeEnd === time) return { timeScope: "point", time }
    if (timeEnd < time)
        return drop(
            `end time ${annotation.timeEnd} before start time ${annotation.time}`
        )
    return { timeScope: "range", startTime: time, endTime: timeEnd }
}

const parseAnnotationTime = (
    value: Time | string,
    interval: TimeInterval
): Time | undefined => {
    if (!isSubYearly(interval))
        return typeof value === "number" ? value : undefined

    if (typeof value !== "string") return undefined
    const date = dayjs.utc(value)
    if (!date.isValid() || date.format("YYYY-MM-DD") !== value) return undefined
    return snapToIntervalStart(convertDateToDaysSinceEpoch(date), interval)
}
