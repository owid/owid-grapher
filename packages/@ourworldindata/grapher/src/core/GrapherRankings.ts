import {
    EntityCode,
    EntityName,
    LinkedRanking,
    LinkedRankingRow,
    OwidVariableRow,
    PrimitiveType,
    Time,
} from "@ourworldindata/types"
import {
    convertDateToDaysSinceEpoch,
    dayjs,
    findClosestTime,
    getTimeDomainFromQueryString,
    isSubYearly,
} from "@ourworldindata/utils"
import { CoreColumn } from "@ourworldindata/core-table"
import { PreparedCalloutTable } from "./GrapherValuesJson"

const WORLD_ENTITY_NAME = "World"

export interface RankingComputationOptions {
    /**
     * Entities that take part in the ranking, mapped to their codes
     * (typically all listed countries, so that aggregates are excluded).
     */
    eligibleEntityNames: Map<EntityName, EntityCode>
    /** Stored as `chartKey` on the result (see makeCalloutGrapherStateKey) */
    chartKey: string
    /**
     * The chart URL's `time` param. Its end bound (snapped to the closest
     * time with data for an eligible entity) is the ranking time. If
     * omitted (or `latest`), the latest time with data for any eligible
     * entity is used. The start bound of a range limits the sparkline.
     */
    timeQueryParam?: string
    /** Short name of the y column to rank by; first y column if omitted */
    column?: string
    /**
     * How far back (in time units) a country's value may be from the ranking
     * time and still be included. Defaults to the map's time tolerance if
     * the column is the map column (so that the ranking matches what the
     * map shows), else to the column's tolerance.
     */
    tolerance?: number
    /** If set, each row gets the value at `time - changeSinceYears` as `prevValue` */
    changeSinceYears?: number
    /** If set, attach the time series of this entity (and World) up to the ranking time */
    includeSparklineFor?: EntityName
    /**
     * The current date; times after it (projections, e.g. population
     * projections stored in the same indicator as historical data) are
     * ignored. Defaults to now; overridable for tests.
     */
    now?: Date
}

type NumericRow = { time: Time; value: number }

/**
 * The latest time that isn't in the future: the current calendar year for
 * yearly columns, or today (as days since epoch) for day-based ones.
 */
const getLatestNonFutureTime = (column: CoreColumn, now: Date): Time =>
    isSubYearly(column.timeInterval)
        ? convertDateToDaysSinceEpoch(dayjs.utc(now))
        : now.getUTCFullYear()

const toNumericRows = (
    rows: OwidVariableRow<PrimitiveType>[] | undefined,
    maxTime: Time
): NumericRow[] =>
    (rows ?? [])
        .filter(
            (row): row is OwidVariableRow<number> =>
                typeof row.value === "number" &&
                Number.isFinite(row.value) &&
                row.originalTime <= maxTime
        )
        .map((row) => ({ time: row.originalTime, value: row.value }))
        .sort((a, b) => a.time - b.time)

/**
 * The latest row at or before `targetTime` that is at most `tolerance`
 * before it. Rows must be sorted by time ascending.
 */
const findRowAtOrBefore = (
    rows: NumericRow[],
    targetTime: Time,
    tolerance: number
): NumericRow | undefined => {
    for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i]
        if (row.time > targetTime) continue
        return targetTime - row.time <= tolerance ? row : undefined
    }
    return undefined
}

/**
 * Collects the values of all eligible entities for one y column of a
 * prepared chart table, so that ranks within any peer group can be derived
 * later (see computeRankSummary in @ourworldindata/utils).
 *
 * Rules:
 * - Only `eligibleEntityNames` are included; World is read separately.
 * - Ranking time: the `time` param's end bound, or the latest time with data.
 * - Each entity contributes its value at the ranking time, or the closest
 *   earlier value within `tolerance`; entities without one are left out.
 * - Non-numeric values are ignored.
 * - Future (i.e. projected) times are ignored, and columns flagged as
 *   projections are never ranked.
 *
 * Returns undefined if the column doesn't exist or no entity has data.
 * Call once per chart/column/options; the result doesn't depend on the
 * profile's entity except for the optional sparkline.
 */
export function computeRankingFromPreparedTable(
    prepared: PreparedCalloutTable,
    options: RankingComputationOptions
): LinkedRanking | undefined {
    const { inputTable, yColumnSlugs, columns, sourcesLine } = prepared

    const columnSlug =
        options.column !== undefined
            ? Object.entries(columns ?? {}).find(
                  ([slug, info]) =>
                      info.shortName === options.column &&
                      yColumnSlugs.includes(slug)
              )?.[0]
            : yColumnSlugs.find((slug) => !inputTable.get(slug).isProjection)
    if (columnSlug === undefined) return undefined

    const column = inputTable.get(columnSlug)
    if (column.isMissing || column.isProjection) return undefined

    const mapTimeTolerance =
        prepared.mapColumnSlug === columnSlug
            ? prepared.mapTimeTolerance
            : undefined
    const tolerance = options.tolerance ?? mapTimeTolerance ?? column.tolerance
    const rowsByEntityName = column.owidRowsByEntityName
    const maxTime = getLatestNonFutureTime(column, options.now ?? new Date())

    const eligibleRows = new Map<EntityCode, NumericRow[]>()
    for (const [entityName, code] of options.eligibleEntityNames) {
        const rows = toNumericRows(rowsByEntityName.get(entityName), maxTime)
        if (rows.length > 0) eligibleRows.set(code, rows)
    }
    if (eligibleRows.size === 0) return undefined

    const eligibleTimes = [
        ...new Set(
            [...eligibleRows.values()].flatMap((rows) =>
                rows.map((row) => row.time)
            )
        ),
    ].sort((a, b) => a - b)

    const time = options.timeQueryParam
        ? findClosestTime(
              eligibleTimes,
              getTimeDomainFromQueryString(options.timeQueryParam)[1]
          )
        : eligibleTimes.at(-1)
    if (time === undefined) return undefined

    const prevTime =
        options.changeSinceYears !== undefined
            ? time - options.changeSinceYears
            : undefined

    const rows: LinkedRankingRow[] = []
    let hasPrevValue = false
    for (const [code, entityRows] of eligibleRows) {
        const current = findRowAtOrBefore(entityRows, time, tolerance)
        if (!current) continue
        const prev =
            prevTime !== undefined
                ? findRowAtOrBefore(entityRows, prevTime, tolerance)
                : undefined
        if (prev) hasPrevValue = true
        rows.push({
            code,
            value: current.value,
            time: current.time,
            formattedValue: column.formatValueShort(current.value),
            ...(prev ? { prevValue: prev.value } : {}),
        })
    }
    if (rows.length === 0) return undefined

    const worldRows = toNumericRows(
        rowsByEntityName.get(WORLD_ENTITY_NAME),
        maxTime
    )
    const worldValue = findRowAtOrBefore(worldRows, time, tolerance)?.value

    const sparkline =
        options.includeSparklineFor !== undefined
            ? computeRankingSparkline(
                  prepared,
                  { columnSlug, time },
                  options.includeSparklineFor,
                  options.timeQueryParam
              )
            : undefined

    const info = columns?.[columnSlug]
    const unit = info?.unit ?? column.unit
    const shortUnit = info?.shortUnit ?? column.shortUnit

    return {
        chartKey: options.chartKey,
        columnSlug,
        title: info?.name ?? column.displayName,
        ...(unit ? { unit } : {}),
        ...(shortUnit ? { shortUnit } : {}),
        source: sourcesLine,
        time,
        formattedTime: column.formatTime(time),
        ...(hasPrevValue && prevTime !== undefined ? { prevTime } : {}),
        rows,
        ...(worldValue !== undefined ? { worldValue } : {}),
        ...(sparkline ? { sparkline } : {}),
    }
}

/**
 * The start bound of a `time` range param (e.g. 1800 for `1800..latest`),
 * or undefined if there is none. A single time (e.g. `2020`) only sets the
 * ranking time and doesn't limit the sparkline.
 */
const getSparklineStartTime = (
    timeQueryParam: string | undefined
): Time | undefined => {
    if (!timeQueryParam?.includes("..")) return undefined
    const [start] = getTimeDomainFromQueryString(timeQueryParam)
    return Number.isFinite(start) ? start : undefined
}

/**
 * The time series of `entityName` (and World) up to the ranking time, for the
 * entity-vs-World sparkline of a ranking computed by
 * {@link computeRankingFromPreparedTable}. Split out so that callers can
 * compute the entity-independent ranking once and attach a sparkline per
 * entity cheaply. If the chart URL's `time` param is a range, the series
 * start at its start bound (e.g. `1800..latest`). Returns undefined if the
 * entity has no data.
 */
export function computeRankingSparkline(
    prepared: PreparedCalloutTable,
    ranking: Pick<LinkedRanking, "columnSlug" | "time">,
    entityName: EntityName,
    timeQueryParam?: string
): LinkedRanking["sparkline"] {
    const column = prepared.inputTable.get(ranking.columnSlug)
    if (column.isMissing) return undefined
    const rowsByEntityName = column.owidRowsByEntityName
    const startTime = getSparklineStartTime(timeQueryParam) ?? -Infinity

    const toSeries = (entity: EntityName): [Time, number][] =>
        toNumericRows(rowsByEntityName.get(entity), ranking.time)
            .filter((row) => row.time >= startTime)
            .map((row) => [row.time, row.value])

    const entitySeries = toSeries(entityName)
    if (entitySeries.length === 0) return undefined
    const worldSeries = toSeries(WORLD_ENTITY_NAME)
    return {
        entity: entitySeries,
        ...(worldSeries.length > 0 ? { world: worldSeries } : {}),
    }
}
