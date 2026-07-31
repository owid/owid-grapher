import { onRequestGet as searchOnRequestGet } from "../api/search/index.js"
import type { Env } from "../_common/env.js"

export default {
    async fetch(request: Request, env: Env) {
        const url = new URL(request.url)
        if (url.pathname === "/api/search") {
            return searchOnRequestGet({ request, env } as never)
        }
        return new Response("Not found", { status: 404 })
    },
}
