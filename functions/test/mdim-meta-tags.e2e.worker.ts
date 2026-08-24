import { rewriteMetaTags } from "../_common/grapherTools.js"
import type { Env } from "../_common/env.js"
import type { MultiDimPageCompanion } from "@ourworldindata/types"

interface RewriteMetaTagsBody {
    html: string
    url: string
    companion?: MultiDimPageCompanion | null
}

export default {
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url)

        try {
            if (
                request.method === "POST" &&
                url.pathname === "/__test__/rewrite-meta-tags"
            ) {
                const body: RewriteMetaTagsBody = await request.json()
                const pageUrl = new URL(body.url)
                const page = new Response(body.html, {
                    headers: { "Content-Type": "text/html" },
                })
                const rewritten = rewriteMetaTags(
                    pageUrl,
                    `${pageUrl.pathname}.png?imType=og`,
                    `${pageUrl.pathname}.png?imType=twitter`,
                    page,
                    async () => body.companion ?? undefined
                )
                return new Response(await rewritten.text(), {
                    headers: { "Content-Type": "text/html" },
                })
            }

            return new Response("Not found", { status: 404 })
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error)
            return Response.json({ error: message }, { status: 500 })
        }
    },
} satisfies ExportedHandler<Env>
