import { Env } from "../_common/env.js"

/** Return a 404 status for tombstones of deleted pages. */
export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
    const response = await env.ASSETS.fetch(request)
    if (response.redirected || response.status !== 200) return response
    return new Response(response.body, {
        headers: response.headers,
        status: 404,
        statusText: "Not Found",
    })
}
