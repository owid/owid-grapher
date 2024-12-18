import { DbPlainChartSlugRedirect, JsonError } from "@ourworldindata/types"
import { getRedirects } from "../../baker/redirects.js"
import {
    redirectWithSourceExists,
    getChainedRedirect,
    getRedirectById,
} from "../../db/model/Redirect.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import { apiRouter } from "../apiRouter.js"
import {
    getRouteWithROTransaction,
    postRouteWithRWTransaction,
    deleteRouteWithRWTransaction,
} from "../functionalRouterHelpers.js"
import { triggerStaticBuild } from "./routeUtils.js"
import * as db from "../../db/db.js"

getRouteWithROTransaction(
    apiRouter,
    "/site-redirects.json",
    async (req, res, trx) => ({ redirects: await getRedirects(trx) })
)

postRouteWithRWTransaction(
    apiRouter,
    "/site-redirects/new",
    async (req, res, trx) => {
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
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/site-redirects/:id",
    async (req, res, trx) => {
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
)

// Get a list of redirects that map old slugs to charts
getRouteWithROTransaction(
    apiRouter,
    "/redirects.json",
    async (req, res, trx) => ({
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
    })
)

postRouteWithRWTransaction(
    apiRouter,
    "/charts/:chartId/redirects/new",
    async (req, res, trx) => {
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
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/redirects/:id",
    async (req, res, trx) => {
        const id = expectInt(req.params.id)

        const redirect = await db.knexRawFirst<DbPlainChartSlugRedirect>(
            trx,
            `SELECT * FROM chart_slug_redirects WHERE id = ?`,
            [id]
        )

        if (!redirect)
            throw new JsonError(`No redirect found for id ${id}`, 404)

        await db.knexRaw(trx, `DELETE FROM chart_slug_redirects WHERE id=?`, [
            id,
        ])
        await triggerStaticBuild(
            res.locals.user,
            `Deleting redirect from ${redirect.slug}`
        )

        return { success: true }
    }
)
