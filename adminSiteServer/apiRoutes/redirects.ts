import { DbPlainChartSlugRedirect, JsonError } from "@ourworldindata/types"
import {
    redirectWithSourceExists,
    getChainedRedirect,
    getRedirectById,
    getRedirects,
} from "../../db/model/Redirect.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import { triggerStaticBuild } from "../../baker/GrapherBakingUtils.js"
import * as db from "../../db/db.js"
import { Request } from "../authentication.js"
import e from "express"

export async function handleGetSiteRedirects(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    return { redirects: await getRedirects(trx) }
}

export async function handlePostNewSiteRedirect(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const { source, target } = req.body
    const sourceAsUrl = new URL(source, "https://ourworldindata.org")
    if (sourceAsUrl.pathname === "/")
        throw new JsonError("Cannot redirect from /", 400)
    if (await redirectWithSourceExists(trx, source)) {
        throw new JsonError(
            `Redirect with source ${source} already exists`,
            400
        )
    }
    const chainedRedirect = await getChainedRedirect(trx, source, target)
    if (chainedRedirect) {
        throw new JsonError(
            "Creating this redirect would create a chain, redirect from " +
                `${chainedRedirect.source} to ${chainedRedirect.target} ` +
                "already exists. " +
                (target === chainedRedirect.source
                    ? `Please create the redirect from ${source} to ` +
                      `${chainedRedirect.target} directly instead.`
                    : `Please delete the existing redirect and create a ` +
                      `new redirect from ${chainedRedirect.source} to ` +
                      `${target} instead.`),
            400
        )
    }
    const { insertId: id } = await db.knexRawInsert(
        trx,
        `INSERT INTO redirects (source, target) VALUES (?, ?)`,
        [source, target]
    )
    await triggerStaticBuild(
        res.locals.user,
        `Creating redirect id=${id} source=${source} target=${target}`
    )
    return { success: true, redirect: { id, source, target } }
}

export async function handleDeleteSiteRedirect(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const id = expectInt(req.params.id)
    const redirect = await getRedirectById(trx, id)
    if (!redirect) {
        throw new JsonError(`No redirect found for id ${id}`, 404)
    }
    await db.knexRaw(trx, `DELETE FROM redirects WHERE id=?`, [id])
    await triggerStaticBuild(
        res.locals.user,
        `Deleting redirect id=${id} source=${redirect.source} target=${redirect.target}`
    )
    return { success: true }
}

export async function handleGetRedirects(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    return {
        redirects: await db.knexRaw(
            trx,
            `-- sql
                SELECT
                    r.id,
                    r.slug,
                    r.chart_id as chartId,
                    chart_configs.slug AS chartSlug
                FROM chart_slug_redirects AS r
                JOIN charts ON charts.id = r.chart_id
                JOIN chart_configs ON chart_configs.id = charts.configId
                ORDER BY r.id DESC
            `
        ),
    }
}

export async function handlePostNewChartRedirect(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const chartId = expectInt(req.params.chartId)
    const fields = req.body as { slug: string }
    const result = await db.knexRawInsert(
        trx,
        `INSERT INTO chart_slug_redirects (chart_id, slug) VALUES (?, ?)`,
        [chartId, fields.slug]
    )
    const redirectId = result.insertId
    const redirect = await db.knexRaw<DbPlainChartSlugRedirect>(
        trx,
        `SELECT * FROM chart_slug_redirects WHERE id = ?`,
        [redirectId]
    )
    return { success: true, redirect: redirect }
}

export async function handleDeleteChartRedirect(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const id = expectInt(req.params.id)

    const redirect = await db.knexRawFirst<DbPlainChartSlugRedirect>(
        trx,
        `SELECT * FROM chart_slug_redirects WHERE id = ?`,
        [id]
    )

    if (!redirect) throw new JsonError(`No redirect found for id ${id}`, 404)

    await db.knexRaw(trx, `DELETE FROM chart_slug_redirects WHERE id=?`, [id])
    await triggerStaticBuild(
        res.locals.user,
        `Deleting redirect from ${redirect.slug}`
    )

    return { success: true }
}
