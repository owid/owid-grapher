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
import { HonoContext } from "../authentication.js"

export async function handleGetSiteRedirects(
    _c: HonoContext,
    trx: db.KnexReadonlyTransaction
) {
    return { redirects: await getRedirects(trx) }
}

export async function handlePostNewSiteRedirect(
    c: HonoContext,
    trx: db.KnexReadWriteTransaction
) {
    const body = await c.req.json()
    const { source, target } = body
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
        c.get("user"),
        `Creating redirect id=${id} source=${source} target=${target}`
    )
    return { success: true, redirect: { id, source, target } }
}

export async function handleDeleteSiteRedirect(
    c: HonoContext,
    trx: db.KnexReadWriteTransaction
) {
    const id = expectInt(c.req.param("id")!)
    const redirect = await getRedirectById(trx, id)
    if (!redirect) {
        throw new JsonError(`No redirect found for id ${id}`, 404)
    }
    await db.knexRaw(trx, `DELETE FROM redirects WHERE id=?`, [id])
    await triggerStaticBuild(
        c.get("user"),
        `Deleting redirect id=${id} source=${redirect.source} target=${redirect.target}`
    )
    return { success: true }
}

export async function handleGetRedirects(
    _c: HonoContext,
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
    c: HonoContext,
    trx: db.KnexReadWriteTransaction
) {
    const chartId = expectInt(c.req.param("chartId")!)
    const body = await c.req.json()
    const fields = body as { slug: string }
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
    c: HonoContext,
    trx: db.KnexReadWriteTransaction
) {
    const id = expectInt(c.req.param("id")!)

    const redirect = await db.knexRawFirst<DbPlainChartSlugRedirect>(
        trx,
        `SELECT * FROM chart_slug_redirects WHERE id = ?`,
        [id]
    )

    if (!redirect) throw new JsonError(`No redirect found for id ${id}`, 404)

    await db.knexRaw(trx, `DELETE FROM chart_slug_redirects WHERE id=?`, [id])
    await triggerStaticBuild(
        c.get("user"),
        `Deleting redirect from ${redirect.slug}`
    )

    return { success: true }
}
