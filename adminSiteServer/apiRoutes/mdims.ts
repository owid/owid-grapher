import {
    ChartSlugRedirectsTableName,
    DbEnrichedMultiDimDataPage,
    DbPlainMultiDimDataPage,
    DbInsertMultiDimRedirect,
    DbPlainMultiDimRedirect,
    JsonError,
    MultiDimDataPageConfigRaw,
    MultiDimDataPagesTableName,
    MultiDimRedirectsTableName,
} from "@ourworldindata/types"
import {
    MultiDimDataPageConfig,
    queryParamsToStr,
    Url,
} from "@ourworldindata/utils"
import {
    getMultiDimDataPageById,
    getMultiDimDataPageByCatalogPath,
} from "../../db/model/MultiDimDataPage.js"
import { redirectWithSourceExists } from "../../db/model/Redirect.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import {
    upsertMultiDim,
    setMultiDimPublished,
    setMultiDimSlug,
} from "../multiDim.js"
import { triggerStaticBuild } from "../../baker/GrapherBakingUtils.js"
import { Request } from "../authentication.js"
import { HandlerResponse } from "../FunctionalRouter.js"
import * as db from "../../db/db.js"
import { getMultiDimViewRecords } from "../../baker/algolia/utils/mdimViews.js"
import {
    validateNewGrapherSlug,
    validateMultiDimSlug,
    isValidCatalogPath,
} from "../validation.js"
import * as z from "zod"

function buildRedirectTargetDescription(
    multiDim: DbEnrichedMultiDimDataPage,
    viewConfigId: string | null
): string {
    let targetDescription = `/grapher/${multiDim.slug}`
    if (viewConfigId) {
        const mdimConfig = MultiDimDataPageConfig.fromObject(multiDim.config)
        const dimensions = mdimConfig.findViewDimensionsByConfigId(viewConfigId)
        if (dimensions) {
            targetDescription += queryParamsToStr(dimensions)
        }
    }
    return targetDescription
}

// Deep-compares two source query param conditions for equality (key order
// insensitive). Both are either null (no condition) or a non-empty object.
function sourceQueryParamsEqual(
    a: Record<string, string | null> | null,
    b: Record<string, string | null> | null
): boolean {
    if (a === null || b === null) return a === b
    const aKeys = Object.keys(a)
    if (aKeys.length !== Object.keys(b).length) return false
    return aKeys.every((key) => Object.hasOwn(b, key) && a[key] === b[key])
}

// The following checks each cover one conflict a new redirect could introduce.
// They're kept as separate functions (rather than one monolithic validator) so
// the bulk endpoint can run the batch-invariant ones (everything except the
// source-query-params duplicate check) once per distinct source/target instead
// of once per entry. `validateMultiDimRedirect` composes them in the original
// order, so the single-redirect and slug-change paths are unaffected.

// Source must not already be the source of a site redirect.
async function checkSourceNotSiteRedirectSource(
    trx: db.KnexReadonlyTransaction,
    source: string
): Promise<void> {
    if (await redirectWithSourceExists(trx, source)) {
        throw new JsonError(
            `'${source}' is already a source of an existing site redirect`,
            400
        )
    }
}

// Source must not already be the source of a chart slug redirect.
async function checkSourceNotChartSlugRedirectSource(
    trx: db.KnexReadonlyTransaction,
    source: string
): Promise<void> {
    const slug = Url.fromURL(source).slug
    const existingChartSlugRedirect = await trx<{ id: number }>(
        ChartSlugRedirectsTableName
    )
        .select("id")
        .where("slug", slug)
        .first()
    if (existingChartSlugRedirect) {
        throw new JsonError(
            `'${source}' is already a source of an existing chart slug redirect`,
            400
        )
    }
}

// Source must not already be the source of a multi-dim redirect. When
// `sourceQueryParams` is provided, the source may repeat as long as the query
// params differ; only an exact duplicate is rejected. When omitted (e.g.
// slug-change validation), any existing multi-dim redirect with this source is a
// conflict. This is the only source-side check that isn't batch-invariant: it
// must observe rows inserted earlier in the same bulk transaction, so it stays
// per-entry.
async function checkSourceNotDuplicateMultiDimRedirect(
    trx: db.KnexReadonlyTransaction,
    source: string,
    sourceQueryParams?: Record<string, string | null> | null
): Promise<void> {
    if (sourceQueryParams === undefined) {
        const existingMultiDimRedirect = await trx<{ id: number }>(
            MultiDimRedirectsTableName
        )
            .select("id")
            .where("source", source)
            .first()
        if (existingMultiDimRedirect) {
            throw new JsonError(
                `'${source}' is already a source of an existing multi-dim redirect`,
                400
            )
        }
        return
    }
    const existingRows = await trx<{ sourceQueryParams: string | null }>(
        MultiDimRedirectsTableName
    )
        .select("sourceQueryParams")
        .where("source", source)
    const isExactDuplicate = existingRows.some((row) =>
        sourceQueryParamsEqual(
            parseSourceQueryParamsColumn(row.sourceQueryParams),
            sourceQueryParams
        )
    )
    if (isExactDuplicate) {
        throw new JsonError(
            `'${source}' is already a source of an existing multi-dim redirect with the same source query params`,
            400
        )
    }
}

// Source must not already be a redirect *target* (would create chain:
// X -> source -> target).
async function checkSourceNotRedirectTarget(
    trx: db.KnexReadonlyTransaction,
    source: string
): Promise<void> {
    const sourceIsTargetOfSiteRedirect = await trx<{ id: number }>("redirects")
        .select("id")
        .where("target", source)
        .first()
    if (sourceIsTargetOfSiteRedirect) {
        throw new JsonError(
            `Creating this redirect would form a redirect chain: '${source}' is already a target of an existing site redirect`,
            400
        )
    }
    const sourceSlug = Url.fromURL(source).slug
    // Multi-dim targets are always at /grapher/ paths, so only check if source is a /grapher/ path
    if (source.startsWith("/grapher/")) {
        const sourceIsMultiDimTarget = await db.knexRaw<{ source: string }>(
            trx,
            `-- sql
            SELECT mdr.source
            FROM ${MultiDimRedirectsTableName} mdr
            JOIN ${MultiDimDataPagesTableName} mdp ON mdr.multiDimId = mdp.id
            WHERE mdp.slug = ?
            LIMIT 1`,
            [sourceSlug]
        )
        if (sourceIsMultiDimTarget.length > 0) {
            throw new JsonError(
                `Creating this redirect would form a redirect chain: '${source}' is already a target of redirect '${sourceIsMultiDimTarget[0].source}'`,
                400
            )
        }
    }
    // Check if source matches a chart's current slug that has old slugs redirecting to it
    const sourceIsChartSlugTarget = await db.knexRaw<{ slug: string }>(
        trx,
        `-- sql
        SELECT csr.slug
        FROM ${ChartSlugRedirectsTableName} csr
        JOIN charts c ON csr.chart_id = c.id
        JOIN chart_configs cc ON c.configId = cc.id
        WHERE cc.slug = ?
        LIMIT 1`,
        [sourceSlug]
    )
    if (sourceIsChartSlugTarget.length > 0) {
        throw new JsonError(
            `Creating this redirect would form a redirect chain: '${source}' is already a target of chart slug redirect '${sourceIsChartSlugTarget[0].slug}'`,
            400
        )
    }
}

// Target (a /grapher/<slug> path) must not already be a redirect source (would
// create chain: source -> target -> Y).
async function checkTargetNotRedirectSource(
    trx: db.KnexReadonlyTransaction,
    targetSlug: string
): Promise<void> {
    const targetPath = `/grapher/${targetSlug}`
    if (await redirectWithSourceExists(trx, targetPath)) {
        throw new JsonError(
            `Creating this redirect would form a redirect chain: target '${targetPath}' is already a source of an existing site redirect`,
            400
        )
    }
    const targetInMultiDim = await trx<{ id: number }>(
        MultiDimRedirectsTableName
    )
        .select("id")
        .where("source", targetPath)
        .first()
    if (targetInMultiDim) {
        throw new JsonError(
            `Creating this redirect would form a redirect chain: target '${targetPath}' is already a source of an existing multi-dim redirect`,
            400
        )
    }
    const targetInChartSlug = await trx<{ id: number }>(
        ChartSlugRedirectsTableName
    )
        .select("id")
        .where("slug", targetSlug)
        .first()
    if (targetInChartSlug) {
        throw new JsonError(
            `Creating this redirect would form a redirect chain: target '${targetPath}' is already a source of an existing chart slug redirect`,
            400
        )
    }
}

async function validatePathIsNotRedirectSource(
    trx: db.KnexReadonlyTransaction,
    path: string,
    // When provided (multi-dim redirect creation), the source path may repeat as
    // long as the source query params differ; only an exact duplicate is
    // rejected. When omitted (e.g. slug-change validation), any existing
    // multi-dim redirect with this source path is treated as a conflict.
    multiDimSourceQueryParams?: Record<string, string | null> | null
): Promise<void> {
    await checkSourceNotSiteRedirectSource(trx, path)
    await checkSourceNotDuplicateMultiDimRedirect(
        trx,
        path,
        multiDimSourceQueryParams
    )
    await checkSourceNotChartSlugRedirectSource(trx, path)
}

async function validateMultiDimRedirect(
    trx: db.KnexReadonlyTransaction,
    source: string,
    targetSlug: string,
    sourceQueryParams: Record<string, string | null> | null
): Promise<void> {
    await validatePathIsNotRedirectSource(trx, source, sourceQueryParams)
    await checkSourceNotRedirectTarget(trx, source)
    await checkTargetNotRedirectSource(trx, targetSlug)
}

async function createSlugChangeRedirect(
    trx: db.KnexReadWriteTransaction,
    multiDim: DbEnrichedMultiDimDataPage,
    previousSlug: string
): Promise<void> {
    const source = `/grapher/${previousSlug}`
    await validateMultiDimRedirect(trx, source, multiDim.slug!, null)
    await trx(MultiDimRedirectsTableName).insert({
        source,
        multiDimId: multiDim.id,
        viewConfigId: null,
    })
}

export async function handleGetMultiDims(
    _req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    try {
        const results = await db.knexRaw<
            Pick<
                DbPlainMultiDimDataPage,
                "id" | "catalogPath" | "slug" | "updatedAt" | "published"
            > & { title: string; pageviews: number; mdimViews: number }
        >(
            trx,
            `-- sql
            SELECT
                mdp.id,
                mdp.catalogPath,
                mdp.slug,
                mdp.config->>'$.title.title' as title,
                mdp.updatedAt,
                mdp.published,
                COALESCE(agv.views_14d, 0) as pageviews,
                COALESCE(JSON_LENGTH(mdp.config, '$.views'), 0) as mdimViews
            FROM ${MultiDimDataPagesTableName} mdp
            LEFT JOIN analytics_grapher_views agv ON (
                agv.grapher_slug = mdp.slug
                AND agv.day = (SELECT MAX(day) FROM analytics_grapher_views)
            )`
        )
        const multiDims = results.map((row) => ({
            ...row,
            published: Boolean(row.published),
            pageviews: Number(row.pageviews),
            mdimViews: Number(row.mdimViews),
        }))
        return { multiDims }
    } catch (error) {
        throw new JsonError("Failed to fetch multi-dims", 500, { cause: error })
    }
}

export async function handleGetMultiDim(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const id = expectInt(req.params.id)
    const row = await trx<DbPlainMultiDimDataPage>(MultiDimDataPagesTableName)
        .select("id", "catalogPath", "slug", "config", "updatedAt", "published")
        .where("id", id)
        .first()
    if (!row) {
        throw new JsonError("Multi-dimensional data page not found", 404)
    }
    const multiDim = {
        ...row,
        config: JSON.parse(row.config),
        published: Boolean(row.published),
    }
    return { multiDim }
}

export async function handlePutMultiDim(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const { catalogPath } = req.params
    if (!isValidCatalogPath(catalogPath)) {
        throw new JsonError(`Invalid multi-dim catalog path ${catalogPath}`)
    }
    const { config: rawConfig } = req.body as {
        config: MultiDimDataPageConfigRaw
    }
    const id = await upsertMultiDim(trx, catalogPath, rawConfig)

    const { slug: publishedSlug } =
        (await trx<DbPlainMultiDimDataPage>(MultiDimDataPagesTableName)
            .select("slug")
            .where("catalogPath", catalogPath)
            .where("published", true)
            .first()) ?? {}
    if (publishedSlug) {
        await triggerStaticBuild(
            res.locals.user,
            `Publishing multidimensional chart ${publishedSlug}`
        )
    }
    return { success: true, id }
}

export async function handlePatchMultiDim(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const id = expectInt(req.params.id)
    let multiDim = await getMultiDimDataPageById(trx, id)
    if (!multiDim) {
        throw new JsonError(`Multi-dimensional data page not found`, 404)
    }
    const { published, slug } = req.body
    let action
    let previousSlug: string | undefined
    if (slug !== undefined && slug !== multiDim.slug) {
        previousSlug = multiDim.slug ?? undefined
        await validateNewGrapherSlug(trx, slug)
        const newSlugSource = `/grapher/${slug}`
        await validatePathIsNotRedirectSource(trx, newSlugSource)
        multiDim = await setMultiDimSlug(trx, multiDim, slug)
        if (multiDim.published) {
            action = "publish"
        }
    }
    if (previousSlug && multiDim.published) {
        await createSlugChangeRedirect(trx, multiDim, previousSlug)
    }

    // Note: Keep this change last, since we don't want to update the configs
    // in R2 when a previous operation fails.
    if (published !== undefined && published !== multiDim.published) {
        if (published) {
            await validateMultiDimSlug(trx, multiDim.slug)
        } else {
            const existingRedirects = await trx<DbPlainMultiDimRedirect>(
                MultiDimRedirectsTableName
            )
                .select("source")
                .where("multiDimId", id)
                .limit(1)

            if (existingRedirects.length > 0) {
                throw new JsonError(
                    `Cannot unpublish multi-dim: redirects exist pointing to this multi-dim (e.g., '${existingRedirects[0].source}'). Please delete the redirects first.`,
                    400
                )
            }
        }
        multiDim = await setMultiDimPublished(trx, multiDim, published)
        action = published ? "publish" : "unpublish"
    }
    if (action) {
        await triggerStaticBuild(
            res.locals.user,
            `${action === "publish" ? "Publishing" : "Unpublishing"} multidimensional chart ${multiDim.slug}`
        )
    }
    return { success: true, multiDim }
}

export async function handleGetMultiDimRedirects(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const multiDimId = expectInt(req.params.id)

    const rows = await db.knexRaw<{
        id: number
        source: string
        sourceQueryParams: string | null
        viewConfigId: string | null
    }>(
        trx,
        `-- sql
        SELECT
            mdr.id,
            mdr.source,
            mdr.sourceQueryParams,
            mdr.viewConfigId
        FROM ${MultiDimRedirectsTableName} mdr
        WHERE mdr.multiDimId = ?
        ORDER BY mdr.createdAt DESC`,
        [multiDimId]
    )

    const redirects = rows.map((row) => ({
        id: row.id,
        source: row.source,
        sourceQueryParams: parseSourceQueryParamsColumn(row.sourceQueryParams),
        viewConfigId: row.viewConfigId,
    }))

    return { redirects }
}

// Parses the JSON `sourceQueryParams` column (returned as a string by the driver)
// into an object for API responses, or null when unset.
function parseSourceQueryParamsColumn(
    raw: string | null
): Record<string, string | null> | null {
    if (!raw) return null
    return JSON.parse(raw) as Record<string, string | null>
}

const postMultiDimRedirectSchema = z.object({
    source: z
        .string()
        .regex(
            /^\/(grapher|explorers)\/.*[^/]$/,
            "Source must start with either /grapher/ or /explorers/ and cannot end with a slash"
        ),
    viewConfigId: z.string().nullable().optional(),
    // Optional source query params the redirect is conditioned on. A `null`
    // value acts as a wildcard for that param. When omitted/empty, the redirect
    // matches regardless of query params.
    sourceQueryParams: z
        .record(z.string(), z.string().nullable())
        .nullable()
        .optional(),
})

// Normalizes an empty object to null so "no condition" is stored consistently.
function normalizeSourceQueryParams(
    sourceQueryParams: Record<string, string | null> | null | undefined
): Record<string, string | null> | null {
    return sourceQueryParams && Object.keys(sourceQueryParams).length > 0
        ? sourceQueryParams
        : null
}

// Validates and inserts a single multi-dim redirect. Does NOT trigger a static
// build — the caller is responsible for that (so bulk operations can build once).
// `validateConflicts` runs the DB-level conflict checks against the confirmed
// (non-null) target slug; it's injected so the bulk path can hoist its
// batch-invariant checks out of the per-entry loop.
async function createMultiDimRedirect(
    trx: db.KnexReadWriteTransaction,
    multiDim: DbEnrichedMultiDimDataPage,
    source: string,
    viewConfigId: string | null,
    sourceQueryParams: Record<string, string | null> | null,
    validateConflicts: (targetSlug: string) => Promise<void>
): Promise<{ id: number }> {
    if (!multiDim.slug) {
        throw new JsonError(
            "Target multi-dim must have a slug before adding redirects",
            400
        )
    }
    if (!multiDim.published) {
        throw new JsonError(
            "Target multi-dim must be published before adding redirects",
            400
        )
    }

    if (viewConfigId) {
        const mdimConfig = MultiDimDataPageConfig.fromObject(multiDim.config)
        const dimensions = mdimConfig.findViewDimensionsByConfigId(viewConfigId)
        if (!dimensions) {
            throw new JsonError(
                `View config '${viewConfigId}' not found for this multi-dim`,
                404
            )
        }
    }

    if (source === `/grapher/${multiDim.slug}`) {
        throw new JsonError(
            "Creating this redirect would redirect to the same page.",
            400
        )
    }

    await validateConflicts(multiDim.slug)

    const [insertId] = await trx<DbInsertMultiDimRedirect>(
        MultiDimRedirectsTableName
    ).insert({
        source,
        sourceQueryParams: sourceQueryParams
            ? JSON.stringify(sourceQueryParams)
            : null,
        multiDimId: multiDim.id,
        viewConfigId,
    })

    return { id: insertId }
}

export async function handlePostMultiDimRedirect(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const multiDimId = expectInt(req.params.id)
    const parseResult = postMultiDimRedirectSchema.safeParse(req.body)
    if (!parseResult.success) {
        throw new JsonError(
            `Invalid request: ${parseResult.error.message}`,
            400
        )
    }
    const { source, viewConfigId } = parseResult.data
    const sourceQueryParams = normalizeSourceQueryParams(
        parseResult.data.sourceQueryParams
    )

    const multiDim = await getMultiDimDataPageById(trx, multiDimId)
    if (!multiDim) {
        throw new JsonError("Multi-dimensional data page not found", 404)
    }

    const { id } = await createMultiDimRedirect(
        trx,
        multiDim,
        source,
        viewConfigId ?? null,
        sourceQueryParams,
        (targetSlug) =>
            validateMultiDimRedirect(trx, source, targetSlug, sourceQueryParams)
    )

    const targetDescription = buildRedirectTargetDescription(
        multiDim,
        viewConfigId ?? null
    )
    await triggerStaticBuild(
        res.locals.user,
        `Creating multi-dim redirect from '${source}' to '${targetDescription}'`
    )

    return {
        success: true,
        redirect: {
            id,
            source,
            sourceQueryParams,
            viewConfigId: viewConfigId ?? null,
        },
    }
}

// Schema for the bulk-redirect input. It intentionally mirrors the structure of
// the mapping files produced by the ETL (the `catchAll` + `redirects` fields),
// so such a file can be posted (mostly) as-is. Unknown fields (e.g.
// `sourceViewId`, `viewId`, `stats`) are ignored by Zod.
//
// - `source` describes an explorer view. Explorer URLs encode dimension choices
//   directly as query params (the dimension title is the param name and the
//   choice label the value), so `source.dimensions` maps 1:1 to the redirect's
//   `sourceQueryParams`. Empty/absent dimensions mean "match any query params".
// - `target` describes the multi-dim view to redirect to, identified by its
//   catalog path and the dimension choices that uniquely select a view. Empty/
//   absent target dimensions mean the multi-dim's default view. In `redirects`,
//   a `null` target marks an entry the ETL couldn't resolve; we skip those.
// - `catchAll` is the unconditional fallback (no source dimensions), applied
//   when no specific `redirects` entry matches the incoming query params.
const bulkRedirectSourceSchema = z.object({
    explorerSlug: z.string(),
    // The explorer dimension choices to match on. Omitted/empty means the
    // redirect matches regardless of query params (the catch-all fallback).
    dimensions: z.record(z.string(), z.string()).optional(),
})

const bulkRedirectTargetSchema = z.object({
    catalogPath: z.string(),
    // The dimension choices that uniquely select the target view. Omitted/empty
    // means the multi-dim's default view (viewConfigId = null).
    dimensions: z.record(z.string(), z.string()).optional(),
})

const bulkMultiDimRedirectsSchema = z.object({
    // Unconditional fallback redirect: applies when no specific `redirects`
    // entry matches the incoming query params. Typically points at the
    // multi-dim's default view.
    catchAll: z
        .object({
            source: bulkRedirectSourceSchema,
            target: bulkRedirectTargetSchema,
        })
        .nullable()
        .optional(),
    redirects: z.array(
        z.object({
            source: bulkRedirectSourceSchema,
            target: bulkRedirectTargetSchema.nullable(),
            unresolvedReason: z.string().optional(),
        })
    ),
})

interface BulkMultiDimRedirectResult {
    source: string
    status: "created" | "skipped" | "error"
    message?: string
    redirectId?: number
}

// Resolves the target view config id for a set of target dimensions. Empty (or
// absent) dimensions map to the multi-dim's default view (null viewConfigId);
// otherwise the dimensions must uniquely identify a view.
function resolveTargetViewConfigId(
    multiDim: DbEnrichedMultiDimDataPage,
    catalogPath: string,
    targetDimensions: Record<string, string> | undefined
): string | null {
    if (!targetDimensions || Object.keys(targetDimensions).length === 0) {
        return null
    }
    const mdimConfig = MultiDimDataPageConfig.fromObject(multiDim.config)
    const view = mdimConfig.findViewByDimensions(targetDimensions)
    if (!view) {
        throw new JsonError(
            `No view in multi-dim '${catalogPath}' matches dimensions ${JSON.stringify(
                targetDimensions
            )}`,
            404
        )
    }
    return view.fullConfigId
}

export async function handleBulkCreateMultiDimRedirects(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const parseResult = bulkMultiDimRedirectsSchema.safeParse(req.body)
    if (!parseResult.success) {
        throw new JsonError(
            `Invalid request: ${parseResult.error.message}`,
            400
        )
    }
    const { redirects, catchAll } = parseResult.data

    // Cache resolved multi-dims by catalog path so we don't hit the DB once per
    // entry (a mapping file typically targets a single multi-dim).
    const multiDimByCatalogPath = new Map<string, DbEnrichedMultiDimDataPage>()
    const results: BulkMultiDimRedirectResult[] = []
    const targetSlugs = new Set<string>()

    const resolveMultiDim = async (
        catalogPath: string
    ): Promise<DbEnrichedMultiDimDataPage> => {
        const cached = multiDimByCatalogPath.get(catalogPath)
        if (cached) return cached
        const multiDim = await getMultiDimDataPageByCatalogPath(
            trx,
            catalogPath
        )
        if (!multiDim) {
            throw new JsonError(
                `No multi-dim found for catalog path '${catalogPath}'`,
                404
            )
        }
        multiDimByCatalogPath.set(catalogPath, multiDim)
        return multiDim
    }

    // The redirect-chain checks that depend only on the source (resp. target)
    // are invariant across a batch — a mapping file typically has one source and
    // one target multi-dim shared by every entry. Memoize them per distinct
    // source/target so they run once instead of once per entry (a cached
    // rejected promise re-throws the same error for every affected entry). Only
    // the source-query-params duplicate check stays per-entry, since it must
    // observe rows inserted earlier in this transaction.
    const sourceChecks = new Map<string, Promise<void>>()
    const validateSourceOnce = (source: string): Promise<void> => {
        let check = sourceChecks.get(source)
        if (!check) {
            check = checkSourceNotSiteRedirectSource(trx, source)
                .then(() => checkSourceNotChartSlugRedirectSource(trx, source))
                .then(() => checkSourceNotRedirectTarget(trx, source))
            sourceChecks.set(source, check)
        }
        return check
    }
    const targetChecks = new Map<string, Promise<void>>()
    const validateTargetOnce = (targetSlug: string): Promise<void> => {
        let check = targetChecks.get(targetSlug)
        if (!check) {
            check = checkTargetNotRedirectSource(trx, targetSlug)
            targetChecks.set(targetSlug, check)
        }
        return check
    }

    // Process the catch-all fallback (if any) alongside the specific redirects.
    // Its empty source dimensions mean a null sourceQueryParams (matches any
    // query params), and its empty target dimensions mean the default view.
    const entries = [
        ...(catchAll ? [{ ...catchAll, unresolvedReason: undefined }] : []),
        ...redirects,
    ]

    // Best-effort: process each entry independently and record its outcome
    // rather than aborting the whole batch on the first failure. Successful
    // inserts all commit together when the surrounding transaction commits.
    for (const entry of entries) {
        const source = `/explorers/${entry.source.explorerSlug}`

        if (!entry.target) {
            results.push({
                source,
                status: "skipped",
                message: entry.unresolvedReason ?? "No target to redirect to",
            })
            continue
        }

        try {
            const { catalogPath, dimensions: targetDimensions } = entry.target
            const multiDim = await resolveMultiDim(catalogPath)
            const viewConfigId = resolveTargetViewConfigId(
                multiDim,
                catalogPath,
                targetDimensions
            )
            const sourceQueryParams = normalizeSourceQueryParams(
                entry.source.dimensions
            )
            const { id } = await createMultiDimRedirect(
                trx,
                multiDim,
                source,
                viewConfigId,
                sourceQueryParams,
                async (targetSlug) => {
                    await validateSourceOnce(source)
                    await validateTargetOnce(targetSlug)
                    await checkSourceNotDuplicateMultiDimRedirect(
                        trx,
                        source,
                        sourceQueryParams
                    )
                }
            )
            if (multiDim.slug) targetSlugs.add(multiDim.slug)
            results.push({ source, status: "created", redirectId: id })
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error)
            results.push({ source, status: "error", message })
        }
    }

    const created = results.filter((r) => r.status === "created").length
    const skipped = results.filter((r) => r.status === "skipped").length
    const errors = results.filter((r) => r.status === "error").length

    if (created > 0) {
        await triggerStaticBuild(
            res.locals.user,
            `Bulk-creating ${created} multi-dim redirect(s) to ${[
                ...targetSlugs,
            ].join(", ")}`
        )
    }

    return { success: true, created, skipped, errors, results }
}

export async function handleDeleteMultiDimRedirect(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const redirectId = expectInt(req.params.redirectId)

    const redirect = await trx<DbPlainMultiDimRedirect>(
        MultiDimRedirectsTableName
    )
        .select("*")
        .where("id", redirectId)
        .first()

    if (!redirect) {
        throw new JsonError(`Redirect with id ${redirectId} not found`, 404)
    }

    const multiDim = await getMultiDimDataPageById(trx, redirect.multiDimId)
    if (!multiDim) {
        throw new JsonError("Multi-dimensional data page not found", 404)
    }

    const viewConfigId = redirect.viewConfigId ?? null

    await trx<DbPlainMultiDimRedirect>(MultiDimRedirectsTableName)
        .where("id", redirectId)
        .delete()

    const targetDescription = buildRedirectTargetDescription(
        multiDim,
        viewConfigId
    )
    await triggerStaticBuild(
        res.locals.user,
        `Deleting multi-dim redirect from '${redirect.source}' to '${targetDescription}'`
    )

    return { success: true }
}

export async function handleGetAllMultiDimRedirects(
    _req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const rows = await db.knexRaw<{
        id: number
        source: string
        sourceQueryParams: string | null
        viewConfigId: string | null
        multiDimId: number
        multiDimSlug: string
        multiDimTitle: string
        multiDimConfig: string
    }>(
        trx,
        `-- sql
        SELECT
            mdr.id,
            mdr.source,
            mdr.sourceQueryParams,
            mdr.viewConfigId,
            mddp.id as multiDimId,
            mddp.slug as multiDimSlug,
            mddp.config->>'$.title.title' as multiDimTitle,
            mddp.config as multiDimConfig
        FROM ${MultiDimRedirectsTableName} mdr
        JOIN ${MultiDimDataPagesTableName} mddp ON mddp.id = mdr.multiDimId
        WHERE mddp.published = 1 AND mddp.slug IS NOT NULL
        ORDER BY mddp.slug, mdr.source`
    )

    const redirects = rows.map((row) => {
        let targetQueryStr: string | null = null
        if (row.viewConfigId) {
            const config = MultiDimDataPageConfig.fromObject(
                JSON.parse(row.multiDimConfig)
            )
            const dimensions = config.findViewDimensionsByConfigId(
                row.viewConfigId
            )
            if (dimensions) {
                targetQueryStr = queryParamsToStr(dimensions)
            }
        }
        return {
            id: row.id,
            source: row.source,
            sourceQueryParams: parseSourceQueryParamsColumn(
                row.sourceQueryParams
            ),
            multiDimId: row.multiDimId,
            multiDimSlug: row.multiDimSlug,
            multiDimTitle: row.multiDimTitle,
            targetQueryStr,
        }
    })

    return { redirects }
}

/**
 * Generate a preview of Algolia index records for a multi-dim.
 * Returns the records that would be created when indexing this multi-dim.
 */
export async function getMdimRecordsJson(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const id = expectInt(req.params.id)
    const records = await getMultiDimViewRecords(trx, { id })
    return { records }
}
