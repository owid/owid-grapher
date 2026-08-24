import { onRequest as grapherOnRequest } from "../grapher/[slug].js"
import { rewriteMetaTags } from "../_common/grapherTools.js"
import type { Env } from "../_common/env.js"
import type { MultiDimPageCompanion } from "@ourworldindata/types"

interface RewriteMetaTagsBody {
    html: string
    url: string
    companion?: MultiDimPageCompanion | null
}

interface SeedAssetBody {
    pathname: string
    body: string
    contentType: string
}

// In-memory stand-in for the static site assets, seeded via /__test__/seed-asset
const seededAssets = new Map<string, { body: string; contentType: string }>()

function makeGrapherContext(request: Request, env: Env) {
    const envWithAssets = {
        ...env,
        ASSETS: {
            fetch: async (input: RequestInfo | URL) => {
                const assetUrl = new URL(
                    input instanceof Request ? input.url : input
                )
                const asset = seededAssets.get(assetUrl.pathname)
                if (!asset) return new Response("Not found", { status: 404 })
                return new Response(asset.body, {
                    headers: { "Content-Type": asset.contentType },
                })
            },
            connect: () => {
                throw new Error("ASSETS.connect is not implemented in tests")
            },
        },
    } as unknown as Env

    const context = {
        request,
        env: envWithAssets,
        params: {},
        data: {},
        functionPath: "/grapher",
        waitUntil: (_promise: Promise<unknown>) => {
            // no-op for tests
        },
        passThroughOnException: () => {
            // no-op for tests
        },
        next: async () => new Response("Not implemented", { status: 500 }),
    }

    return context as unknown as Parameters<typeof grapherOnRequest>[0]
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
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

            if (
                request.method === "POST" &&
                url.pathname === "/__test__/seed-asset"
            ) {
                const body: SeedAssetBody = await request.json()
                seededAssets.set(body.pathname, {
                    body: body.body,
                    contentType: body.contentType,
                })
                return Response.json({ ok: true })
            }

            if (
                request.method === "POST" &&
                url.pathname === "/__test__/clear-assets"
            ) {
                seededAssets.clear()
                return Response.json({ ok: true })
            }

            if (url.pathname.startsWith("/grapher/")) {
                const context = makeGrapherContext(request, env)
                return grapherOnRequest(context)
            }

            return new Response("Not found", { status: 404 })
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error)
            return Response.json({ error: message }, { status: 500 })
        }
    },
} satisfies ExportedHandler<Env>
