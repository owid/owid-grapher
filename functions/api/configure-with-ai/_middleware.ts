import { Env } from "../../_common/env.js"

// In local development the site runs on the admin server's port and calls
// these functions on the functions server's port, so allow that origin.
// Staging and production call them from the same origin.

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
    if (env.ENV !== "development") return next()
    if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers: CORS_HEADERS })
    const response = await next()
    const withCors = new Response(response.body, response)
    for (const [key, value] of Object.entries(CORS_HEADERS))
        withCors.headers.set(key, value)
    return withCors
}
