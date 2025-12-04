import {
    ChartSlugRedirectsTableName,
    DbEnrichedMultiDimDataPage,
    DbPlainMultiDimDataPage,
    DbInsertMultiDimRedirect,
    DbPlainMultiDimRedirect,
    ExplorersTableName,
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
    getMultiDimDataPageBySlug,
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
import * as db from "../../db/db.js"
import {
    validateNewGrapherSlug,
    validateMultiDimSlug,
    isValidCatalogPath,
} from "../validation.js"
import e from "express"
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

export async function handleGetMultiDims(
    _req: Request,
    _res: e.Response<any, Record<string, any>>,
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
    _res: e.Response<any, Record<string, any>>,
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
    res: e.Response<any, Record<string, any>>,
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
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const id = expectInt(req.params.id)
    let multiDim = await getMultiDimDataPageById(trx, id)
    if (!multiDim) {
        throw new JsonError(`Multi-dimensional data page not found`, 404)
    }
    const { published, slug } = req.body
    let action
    if (slug !== undefined && slug !== multiDim.slug) {
        await validateNewGrapherSlug(trx, slug)
        multiDim = await setMultiDimSlug(trx, multiDim, slug)
        if (multiDim.published) {
            action = "publish"
        }
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
    _res: e.Response<any, Record<string, any>>,
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
    res: e.Response<any, Record<string, any>>,
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

    const existingRedirect = await trx<{ id: number }>(
        MultiDimRedirectsTableName
    )
        .select("id")
        .where("source", source)
        .first()

    if (existingRedirect) {
        throw new JsonError(
            `A redirect with source '${source}' already exists`,
            400
        )
    }

    const targetDescription = buildRedirectTargetDescription(
        multiDim,
        viewConfigId ?? null
    )

    if (source === `/grapher/${multiDim.slug}`) {
        throw new JsonError(
            "Creating this redirect would redirect to the same page.",
            400
        )
    }

    const sourceSlug = Url.fromURL(source).slug

    if (await redirectWithSourceExists(trx, source)) {
        throw new JsonError(
            `A site redirect with source '${source}' already exists`,
            400
        )
    }

    const existingChartSlugRedirect = await trx<{ id: number }>(
        ChartSlugRedirectsTableName
    )
        .select("id")
        .where("slug", sourceSlug)
        .first()

    if (existingChartSlugRedirect) {
        throw new JsonError(
            `A chart slug redirect with source '${sourceSlug}' already exists`,
            400
        )
    }

    const publishedChartExists = source.startsWith("/grapher")
        ? await trx("chart_configs")
              .leftJoin("charts", "charts.configId", "chart_configs.id")
              .select(trx.raw("1"))
              .where("chart_configs.slug", sourceSlug)
              .whereNotNull("charts.publishedAt")
              .first()
        : false

    const publishedExplorerExists = source.startsWith("/explorers")
        ? await trx(ExplorersTableName)
              .select(trx.raw("1"))
              .where({ slug: sourceSlug, isPublished: true })
              .first()
        : false

    const publishedMultiDimExists = source.startsWith("/grapher")
        ? await trx(MultiDimDataPagesTableName)
              .select(trx.raw("1"))
              .where({ slug: sourceSlug, published: true })
              .whereNot("id", multiDimId)
              .first()
        : false

    let publishedConflict: string | null = null
    if (publishedChartExists) {
        publishedConflict = "a published chart"
    } else if (publishedExplorerExists) {
        publishedConflict = "a published explorer"
    } else if (publishedMultiDimExists) {
        publishedConflict = "a published multi-dim"
    }

    if (publishedConflict) {
        throw new JsonError(
            `Source '${source}' conflicts with ${publishedConflict}`,
            400
        )
    }

    if (sourceSlug) {
        const sourceMultiDim = await getMultiDimDataPageBySlug(
            trx,
            sourceSlug,
            { onlyPublished: false }
        )

        if (sourceMultiDim && sourceMultiDim.id !== multiDimId) {
            const existingTargetRedirect = await trx<{
                source: string
                viewConfigId: string | null
            }>(`${MultiDimRedirectsTableName} as mdr`)
                .select("mdr.source", "mdr.viewConfigId")
                .where("mdr.multiDimId", sourceMultiDim.id)
                .first()

            if (existingTargetRedirect) {
                const existingTargetDescription =
                    buildRedirectTargetDescription(
                        sourceMultiDim,
                        existingTargetRedirect.viewConfigId ?? null
                    )
                throw new JsonError(
                    "Creating this redirect would create a chain, redirect from " +
                        `${existingTargetRedirect.source} to ${existingTargetDescription} ` +
                        "already exists. Please update that redirect to point " +
                        `directly to ${targetDescription} instead.`,
                    400
                )
            }
        }
    }

    const [insertId] = await trx<DbInsertMultiDimRedirect>(
        MultiDimRedirectsTableName
    ).insert({
        source,
        multiDimId,
        viewConfigId,
    })

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
    res: e.Response<any, Record<string, any>>,
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
