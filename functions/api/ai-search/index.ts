import { Env } from "../../_common/env.js"

/**
 * Redirect /api/ai-search to /api/ai-search/charts for backward compatibility
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const url = new URL(context.request.url)

    // Redirect to /api/ai-search/charts with same query params
    const chartsUrl = new URL(`${url.origin}/api/ai-search/charts${url.search}`)

    return Response.redirect(chartsUrl.toString(), 302)
}
