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
import { getMultiDimDataPageById } from "../../db/model/MultiDimDataPage.js"
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

async function validatePathIsNotRedirectSource(
    trx: db.KnexReadonlyTransaction,
    path: string
): Promise<void> {
    if (await redirectWithSourceExists(trx, path)) {
        throw new JsonError(
            `'${path}' is already a source of an existing site redirect`,
            400
        )
    }
    const existingMultiDimRedirect = await trx<{ id: number }>(
        MultiDimRedirectsTableName
    )
        .select("id")
        .where("source", path)
        .first()
    if (existingMultiDimRedirect) {
        throw new JsonError(
            `'${path}' is already a source of an existing multi-dim redirect`,
            400
        )
    }
    const slug = Url.fromURL(path).slug
    const existingChartSlugRedirect = await trx<{ id: number }>(
        ChartSlugRedirectsTableName
    )
        .select("id")
        .where("slug", slug)
        .first()
    if (existingChartSlugRedirect) {
        throw new JsonError(
            `'${path}' is already a source of an existing chart slug redirect`,
            400
        )
    }
}

async function validateMultiDimRedirect(
    trx: db.KnexReadonlyTransaction,
    source: string,
    targetSlug: string
): Promise<void> {
    const targetPath = `/grapher/${targetSlug}`

    // Check source is not already a redirect source
    await validatePathIsNotRedirectSource(trx, source)

    // Check source is not already a redirect target (would create chain: X -> source -> target)
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

    // Check target is not already a redirect source (would create chain: source -> target -> Y)
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

async function createSlugChangeRedirect(
    trx: db.KnexReadWriteTransaction,
    multiDim: DbEnrichedMultiDimDataPage,
    previousSlug: string
): Promise<void> {
    const source = `/grapher/${previousSlug}`
    await validateMultiDimRedirect(trx, source, multiDim.slug!)
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
            > & { title: string }
        >(
            trx,
            `-- sql
            SELECT
                id,
                catalogPath,
                slug,
                config->>'$.title.title' as title,
                updatedAt,
                published
            FROM ${MultiDimDataPagesTableName}`
        )
        const multiDims = results.map((row) => ({
            ...row,
            published: Boolean(row.published),
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

    const redirects = await db.knexRaw<{
        id: number
        source: string
        viewConfigId: string | null
    }>(
        trx,
        `-- sql
        SELECT
            mdr.id,
            mdr.source,
            mdr.viewConfigId
        FROM ${MultiDimRedirectsTableName} mdr
        WHERE mdr.multiDimId = ?
        ORDER BY mdr.createdAt DESC`,
        [multiDimId]
    )

    return { redirects }
}

const postMultiDimRedirectSchema = z.object({
    source: z
        .string()
        .regex(
            /^\/(grapher|explorers)\/.*[^/]$/,
            "Source must start with either /grapher/ or /explorers/ and cannot end with a slash"
        ),
    viewConfigId: z.string().nullable().optional(),
})

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

    const multiDim = await getMultiDimDataPageById(trx, multiDimId)
    if (!multiDim) {
        throw new JsonError("Multi-dimensional data page not found", 404)
    }
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

    await validateMultiDimRedirect(trx, source, multiDim.slug)

    const [insertId] = await trx<DbInsertMultiDimRedirect>(
        MultiDimRedirectsTableName
    ).insert({
        source,
        multiDimId,
        viewConfigId,
    })

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
            id: insertId,
            source,
            viewConfigId: viewConfigId ?? null,
        },
    }
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
            multiDimId: row.multiDimId,
            multiDimSlug: row.multiDimSlug,
            multiDimTitle: row.multiDimTitle,
            targetQueryStr,
        }
    })

    return { redirects }
}
