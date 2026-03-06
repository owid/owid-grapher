import { onRequest as grapherOnRequest } from "../grapher/[slug].js"
import type { Env } from "../_common/env.js"

interface SeedR2Body {
    bucket: "primary" | "fallback"
    key: string
    value: string
    contentType?: string
}

function getBucket(env: Env, bucket: "primary" | "fallback"): R2Bucket {
    if (bucket === "primary") {
        if (!env.GRAPHER_CONFIG_R2_BUCKET) {
            throw new Error("Missing GRAPHER_CONFIG_R2_BUCKET binding")
        }
        return env.GRAPHER_CONFIG_R2_BUCKET
    }

    if (!env.GRAPHER_CONFIG_R2_BUCKET_FALLBACK) {
        throw new Error("Missing GRAPHER_CONFIG_R2_BUCKET_FALLBACK binding")
    }
    return env.GRAPHER_CONFIG_R2_BUCKET_FALLBACK
}

async function deleteAllObjects(bucket: R2Bucket): Promise<void> {
    let cursor: string | undefined
    do {
        const listed = await bucket.list({ cursor })
        if (listed.objects.length > 0) {
            await bucket.delete(listed.objects.map((obj) => obj.key))
        }
        cursor = listed.truncated ? listed.cursor : undefined
    } while (cursor)
}

function makeGrapherContext(request: Request, env: Env) {
    const envWithAssets = {
        ...env,
        ASSETS: {
            fetch: async () => new Response("Not found", { status: 404 }),
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
                url.pathname === "/__test__/clear-r2"
            ) {
                await deleteAllObjects(getBucket(env, "primary"))
                await deleteAllObjects(getBucket(env, "fallback"))
                return Response.json({ ok: true })
            }

            if (
                request.method === "POST" &&
                url.pathname === "/__test__/seed-r2"
            ) {
                const body = (await request.json()) as SeedR2Body
                const bucket = getBucket(env, body.bucket)
                await bucket.put(body.key, body.value, {
                    httpMetadata: body.contentType
                        ? { contentType: body.contentType }
                        : undefined,
                })
                return Response.json({ ok: true })
            }

            if (
                request.method === "GET" &&
                url.pathname === "/__test__/r2-has-key"
            ) {
                const bucket = url.searchParams.get("bucket") as
                    | "primary"
                    | "fallback"
                    | null
                const key = url.searchParams.get("key")
                if (!bucket || !key) {
                    return new Response("Missing bucket or key", {
                        status: 400,
                    })
                }

                const object = await getBucket(env, bucket).head(key)
                return Response.json({ exists: !!object })
            }

            if (
                url.pathname.startsWith("/grapher/") &&
                url.pathname.endsWith(".config.json")
            ) {
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
