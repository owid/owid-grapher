import * as _ from "lodash-es"
import * as db from "../db.js"
import {
    DbInsertVariable,
    DbRawVariable,
    VariablesTableName,
    OwidVariableType,
} from "@ourworldindata/types"
import { hashHex } from "../../serverUtils/hash.js"
import {
    indicatorDataPath,
    publishIndicatorMetadata,
} from "../../serverUtils/r2/dataApiR2Helpers.js"
import { cleanupGhostVariables } from "./Variable.js"

/**
 * Upserting a variable and building the `<id>.metadata.json` that goes with it.
 *
 * This used to live in ETL (`apps/backport/datasync/data_metadata.py`), which had to write
 * the rows and then read them all back out again to assemble the JSON — the ids, the
 * timestamps and the resolved tag/FAQ links only exist once MySQL has seen them. Doing both
 * halves here means the assembly can use what the write just produced.
 *
 * ETL still owns the values: it sends the `type` it inferred from them, the entity ids and
 * the years, and it uploads `<id>.data.json` to R2 itself.
 */

/** An origin as ETL sends it. Matches the columns of the `origins` table. */
export interface VariableOriginInput {
    title?: string | null
    titleSnapshot?: string | null
    description?: string | null
    descriptionSnapshot?: string | null
    producer?: string | null
    citationFull?: string | null
    attribution?: string | null
    attributionShort?: string | null
    versionProducer?: string | null
    urlMain?: string | null
    urlDownload?: string | null
    dateAccessed?: string | null
    datePublished?: string | null
    license?: { name?: string; url?: string } | null
}

export interface VariableUpsertInput {
    catalogPath: string
    shortName: string
    name?: string | null
    unit: string
    shortUnit?: string | null
    description?: string | null
    descriptionShort?: string | null
    descriptionFromProducer?: string | null
    /** Markdown string. Lists are ETL's legacy representation and are normalised before sending. */
    descriptionKey?: string | null
    descriptionProcessing?: string | null
    titlePublic?: string | null
    titleVariant?: string | null
    attribution?: string | null
    attributionShort?: string | null
    coverage: string
    timespan: string
    display?: Record<string, unknown>
    dimensions?: Record<string, unknown> | null
    schemaVersion?: number | null
    processingLevel?: string | null
    license?: Record<string, unknown> | null
    licenses?: Record<string, unknown>[] | null
    sort?: string[] | null
    /** Inferred by ETL from the values, which never reach us. */
    type: OwidVariableType
    origins: VariableOriginInput[]
    topicTags: string[]
    faqs: { gdocId: string; fragmentId: string }[]
    /** Distinct entity ids present in the data; names and codes are resolved here. */
    entityIds: number[]
    /** Distinct years present in the data. */
    years: number[]
    /** Hash of the values, computed by ETL. We compare it; we never see the values. */
    dataChecksum: string
}

/** Dataset-level fields the indicator JSON embeds. */
export interface DatasetMetadataFields {
    datasetId: number
    datasetName: string | null
    datasetVersion: string | null
    nonRedistributable: boolean
    updatePeriodDays: number | null
}

export interface UpsertedIndicator {
    /** Where ETL should PUT `<id>.data.json`. Opaque to the caller. */
    dataPath: string
    /** Whether the values changed since the last run.  */
    uploadData: boolean
}

const ORIGIN_MATCH_COLUMNS = [
    "producer",
    "citationFull",
    "titleSnapshot",
    "title",
    "attribution",
    "attributionShort",
    "versionProducer",
    "urlMain",
    "urlDownload",
    "descriptionSnapshot",
    "description",
    "datePublished",
    "dateAccessed",
] as const

/** Drop nulls, undefined and empty arrays, the way the published JSON has always been pruned. */
function omitNullableValues<T extends Record<string, any>>(
    obj: T
): Record<string, any> {
    const out: Record<string, any> = {}
    for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
            if (value.length > 0) out[key] = value
        } else if (value !== null && value !== undefined) {
            out[key] = value
        }
    }
    return out
}

/** Population is generic context rather than a source, so data pages list it last. */
function movePopulationOriginToEnd(
    origins: Record<string, any>[]
): Record<string, any>[] {
    const [population, rest] = _.partition(
        origins,
        (origin) =>
            origin.title === "Population" &&
            origin.producer === "Various sources"
    )
    return [...rest, ...population]
}

/**
 * Find or create each origin, returning ids in the order given.
 *
 * Matching is on every column except `license`, which is JSON and awkward to compare. The
 * table is allowed to hold duplicate rows — an origin can be inserted twice by concurrent
 * steps — so when several match we take the first rather than trying to reconcile them.
 */
export async function upsertOrigins(
    trx: db.KnexReadWriteTransaction,
    origins: VariableOriginInput[]
): Promise<number[]> {
    const ids: number[] = []
    for (const origin of origins) {
        const query = trx("origins")
        for (const column of ORIGIN_MATCH_COLUMNS) {
            const value = (origin as Record<string, any>)[column] ?? null
            if (value === null) query.whereNull(column)
            else query.where(column, value)
        }
        const existing = await query.select("id").orderBy("id").first()
        if (existing) {
            ids.push(existing.id)
            continue
        }
        const [id] = await trx("origins").insert({
            ..._.pick(origin, [...ORIGIN_MATCH_COLUMNS]),
            license: origin.license ? JSON.stringify(origin.license) : null,
        })
        ids.push(id)
    }
    return ids
}

async function replaceLinks(
    trx: db.KnexReadWriteTransaction,
    table: string,
    variableId: number,
    rows: Record<string, any>[]
): Promise<void> {
    await trx(table).where({ variableId }).delete()
    if (rows.length > 0) {
        await trx(table).insert(rows.map((row) => ({ ...row, variableId })))
    }
}

/**
 * Resolve topic tag names to ids, dropping any that don't exist.
 *
 * Silently dropping unknown tags is long-standing behaviour: ETL writes the links through a
 * join on `tags`, so a tag nobody created simply never gets linked, and the published JSON
 * reflects the links rather than what was asked for.
 */
async function resolveTopicTagIds(
    trx: db.KnexReadWriteTransaction,
    tagNames: string[]
): Promise<{ id: number; name: string }[]> {
    if (tagNames.length === 0) return []
    const rows = await trx("tags")
        .whereIn("name", tagNames)
        .select("id", "name")
    const byName = new Map(rows.map((row) => [row.name, row.id]))
    return tagNames
        .filter((name) => byName.has(name))
        .map((name) => ({ id: byName.get(name)!, name }))
}

function toVariableRow(
    input: VariableUpsertInput,
    datasetId: number,
    now: Date
): DbInsertVariable {
    return {
        datasetId,
        catalogPath: input.catalogPath,
        shortName: input.shortName,
        name: input.name ?? null,
        unit: input.unit,
        shortUnit: input.shortUnit ?? null,
        description: input.description ?? null,
        descriptionShort: input.descriptionShort ?? null,
        descriptionFromProducer: input.descriptionFromProducer ?? null,
        // `descriptionKey` is a JSON column holding a single markdown string, so the string
        // has to be JSON-encoded on the way in and decoded again for the published metadata.
        descriptionKey: input.descriptionKey
            ? JSON.stringify(input.descriptionKey)
            : null,
        descriptionProcessing: input.descriptionProcessing ?? null,
        titlePublic: input.titlePublic ?? null,
        titleVariant: input.titleVariant ?? null,
        attribution: input.attribution ?? null,
        attributionShort: input.attributionShort ?? null,
        coverage: input.coverage,
        timespan: input.timespan,
        display: JSON.stringify(input.display ?? {}),
        dimensions: input.dimensions ? JSON.stringify(input.dimensions) : null,
        schemaVersion: input.schemaVersion ?? undefined,
        processingLevel: input.processingLevel ?? null,
        license: input.license ? JSON.stringify(input.license) : null,
        licenses: input.licenses ? JSON.stringify(input.licenses) : null,
        sort: input.sort ? JSON.stringify(input.sort) : null,
        type: input.type,
        sourceId: null,
        updatedAt: now,
    }
}

/**
 * Build the published indicator metadata from what we just wrote, rather than reading it
 * back. Field order and pruning follow the JSON that ETL has been publishing.
 */
function buildVariableMetadata(
    row: DbRawVariable,
    dataset: DatasetMetadataFields,
    input: VariableUpsertInput,
    origins: Record<string, any>[],
    topicTags: string[],
    entities: { id: number; name: string | null; code: string | null }[],
    createdAt: Date,
    updatedAt: Date
): Record<string, any> {
    const timeFormat = (date: Date): string =>
        date.toISOString().replace(/\.\d{3}Z$/, ".000Z")

    const presentation = omitNullableValues({
        titlePublic: row.titlePublic,
        titleVariant: row.titleVariant,
        attributionShort: row.attributionShort,
        attribution: row.attribution,
        topicTagsLinks: topicTags,
        faqs: input.faqs.map((faq) => ({
            gdocId: faq.gdocId,
            fragmentId: faq.fragmentId,
        })),
    })

    const metadata: Record<string, any> = omitNullableValues({
        id: row.id,
        name: row.name,
        unit: row.unit,
        description: row.description,
        createdAt: timeFormat(createdAt),
        updatedAt: timeFormat(updatedAt),
        code: row.code,
        coverage: row.coverage,
        timespan: row.timespan,
        datasetId: dataset.datasetId,
        shortUnit: row.shortUnit,
        columnOrder: row.columnOrder,
        shortName: row.shortName,
        catalogPath: row.catalogPath,
        type: row.type,
        descriptionShort: row.descriptionShort,
        descriptionFromProducer: row.descriptionFromProducer,
        descriptionProcessing: row.descriptionProcessing,
        datasetName: dataset.datasetName,
        datasetVersion: dataset.datasetVersion,
        updatePeriodDays: dataset.updatePeriodDays,
    })

    metadata.nonRedistributable = Boolean(dataset.nonRedistributable)
    metadata.display = input.display ?? {}
    if (row.schemaVersion !== null && row.schemaVersion !== undefined)
        metadata.schemaVersion = row.schemaVersion
    if (input.processingLevel) metadata.processingLevel = input.processingLevel
    if (Object.keys(presentation).length > 0)
        metadata.presentation = presentation
    if (input.license) metadata.license = input.license
    if (input.descriptionKey) metadata.descriptionKey = input.descriptionKey

    if (!metadata.type) throw new Error("type must be set")

    metadata.dimensions = {
        years: { values: input.years.map((year) => ({ id: year })) },
        entities: {
            values: entities.map((entity) =>
                omitNullableValues({
                    id: entity.id,
                    name: entity.name,
                    code: entity.code,
                })
            ),
        },
    }
    if (input.sort && input.sort.length > 0) {
        metadata.dimensions.values = {
            values: input.sort.map((name, i) => ({ id: i, name })),
        }
    }

    metadata.origins = movePopulationOriginToEnd(origins)

    return metadata
}

/**
 * Reconcile a dataset's membership against the indicators it should contain.
 *
 * The list is authoritative: anything in the dataset and not on it is a ghost, by definition
 * rather than by inference from silence. Indicators a chart still uses are reported back
 * instead of being deleted — whether that should fail the caller's run depends on the caller.
 */
export interface ReconcileResult {
    removed: string[]
    blocked: {
        catalogPath: string | null
        charts: { id: number; slug: string | null }[]
    }[]
    /** `chart_configs` rows deleted with them, for the caller to remove from R2. */
    configIds: string[]
}

export async function reconcileDatasetIndicators(
    trx: db.KnexReadWriteTransaction,
    datasetId: number,
    catalogPaths: string[]
): Promise<ReconcileResult> {
    const existing = await trx<DbRawVariable>(VariablesTableName)
        .where({ datasetId })
        .select("id", "catalogPath")
    const pathById = new Map(existing.map((row) => [row.id, row.catalogPath]))

    const declared = new Set(catalogPaths)
    const keep = existing
        .filter((row) => row.catalogPath && declared.has(row.catalogPath))
        .map((row) => row.id)

    const { deleted, blocked, configIds } = await cleanupGhostVariables(
        trx,
        datasetId,
        keep
    )

    const byPath = new Map<string | null, ReconcileResult["blocked"][number]>()
    for (const row of blocked) {
        const entry = byPath.get(row.catalogPath) ?? {
            catalogPath: row.catalogPath,
            charts: [],
        }
        entry.charts.push({ id: row.chartId, slug: row.chartSlug })
        byPath.set(row.catalogPath, entry)
    }

    return {
        removed: deleted
            .map((id) => pathById.get(id))
            .filter((path): path is string => !!path),
        blocked: [...byPath.values()],
        configIds,
    }
}

/**
 * Upsert a chunk of a dataset's indicators, publish the metadata each one describes, and say
 * which data files ETL still needs to upload.
 *
 * Everything about metadata happens here and succeeds or fails together: the rows, the
 * rendered JSON in R2, and the checksum that says the two agree. `dataChecksum` is
 * deliberately *not* written — ETL hasn't uploaded the values yet, so it wouldn't be true.
 */
export async function upsertIndicators(
    trx: db.KnexReadWriteTransaction,
    dataset: DatasetMetadataFields,
    inputs: VariableUpsertInput[]
): Promise<Record<string, UpsertedIndicator>> {
    // Entity names and codes live here, so ETL only has to send ids.
    const entityIds = _.uniq(inputs.flatMap((input) => input.entityIds))
    const entityRows = entityIds.length
        ? await trx("entities")
              .whereIn("id", entityIds)
              .select("id", "name", "code")
        : []
    const entitiesById = new Map(entityRows.map((row) => [row.id, row]))

    const results: Record<string, UpsertedIndicator> = {}

    for (const input of inputs) {
        const now = new Date()
        const originIds = await upsertOrigins(trx, input.origins)

        const existing = await trx<DbRawVariable>(VariablesTableName)
            .where({
                catalogPath: input.catalogPath,
                datasetId: dataset.datasetId,
            })
            .first()

        const row = toVariableRow(input, dataset.datasetId, now)
        let variableId: number
        if (existing) {
            variableId = existing.id
            await trx(VariablesTableName).where({ id: variableId }).update(row)
        } else {
            const [id] = await trx(VariablesTableName).insert({
                ...row,
                createdAt: now,
            })
            variableId = id
        }

        await replaceLinks(
            trx,
            "origins_variables",
            variableId,
            originIds.map((originId, displayOrder) => ({
                originId,
                displayOrder,
            }))
        )
        const topicTags = await resolveTopicTagIds(trx, input.topicTags)
        await replaceLinks(
            trx,
            "tags_variables_topic_tags",
            variableId,
            topicTags.map((tag, displayOrder) => ({
                tagId: tag.id,
                displayOrder,
            }))
        )
        await replaceLinks(
            trx,
            "posts_gdocs_variables_faqs",
            variableId,
            input.faqs.map((faq, displayOrder) => ({
                gdocId: faq.gdocId,
                fragmentId: faq.fragmentId,
                displayOrder,
            }))
        )

        const saved = await trx<DbRawVariable>(VariablesTableName)
            .where({ id: variableId })
            .first()
        if (!saved)
            throw new Error(`Variable ${variableId} vanished mid-transaction`)

        const originRows = await trx("origins")
            .whereIn("id", originIds)
            .select("*")
        const originsById = new Map(originRows.map((o) => [o.id, o]))

        const metadata = buildVariableMetadata(
            saved,
            dataset,
            input,
            originIds
                .map((id) => originsById.get(id))
                .filter(Boolean)
                .map((origin) =>
                    omitNullableValues({
                        ...origin,
                        license:
                            typeof origin.license === "string"
                                ? JSON.parse(origin.license)
                                : origin.license,
                    })
                ),
            topicTags.map((tag) => tag.name),
            input.entityIds.map(
                (id) => entitiesById.get(id) ?? { id, name: null, code: null }
            ),
            // Always the persisted value: MySQL truncates sub-second precision, so using the
            // in-memory `now` on the insert would hash differently from every later run.
            saved.createdAt,
            now
        )

        // `updatedAt` moves every run, so hash the metadata without it — otherwise every
        // indicator would look changed on every run and we'd republish the whole catalogue.
        const { updatedAt: _ignored, ...stable } = metadata
        const metadataChecksum = hashHex(JSON.stringify(stable), null)

        if (metadataChecksum !== saved.metadataChecksum) {
            await publishIndicatorMetadata(variableId, metadata)
            await trx(VariablesTableName)
                .where({ id: variableId })
                .update({ metadataChecksum })
        }

        results[input.catalogPath] = {
            dataPath: indicatorDataPath(variableId),
            uploadData: saved.dataChecksum !== input.dataChecksum,
        }
    }

    return results
}

/**
 * Record the checksums of the data files ETL has just published, and the dataset's source
 * checksum.
 *
 * This is the only place `dataChecksum` is written, and it happens after the upload it
 * describes — so a run that dies leaves the file looking stale and gets it re-uploaded next
 * time, rather than leaving a checksum that claims an old file is current.
 */
export async function recordPublishedData(
    trx: db.KnexReadWriteTransaction,
    datasetId: number,
    publishedData: Record<string, string>,
    sourceChecksum: string
): Promise<number> {
    let updated = 0
    for (const [catalogPath, dataChecksum] of Object.entries(publishedData)) {
        updated += await trx(VariablesTableName)
            .where({ catalogPath, datasetId })
            .update({ dataChecksum })
    }
    await trx("datasets").where({ id: datasetId }).update({
        sourceChecksum,
        dataEditedAt: new Date(),
        metadataEditedAt: new Date(),
    })
    return updated
}
