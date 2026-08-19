import { onRequestGet as searchOnRequestGet } from "../api/search/index.js"
import {
    onRequestPost as cachedQueriesOnRequestPost,
    onRequestOptions as cachedQueriesOnRequestOptions,
} from "../api/search/cached-queries.js"
import type { Env } from "../_common/env.js"

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url)
        if (url.pathname === "/api/search") {
            return searchOnRequestGet({ request, env } as never)
        }
        if (url.pathname === "/api/search/cached-queries") {
            const context = {
                request,
                env,
                waitUntil: ctx.waitUntil.bind(ctx),
            }
            if (request.method === "POST")
                return cachedQueriesOnRequestPost(context as never)
            if (request.method === "OPTIONS")
                return cachedQueriesOnRequestOptions(context as never)
        }
        return new Response("Not found", { status: 404 })
    },
}
