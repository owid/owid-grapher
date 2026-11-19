import * as Sentry from "@sentry/cloudflare"
import { analyticsMiddleware } from "../../_common/analytics.js"
import { isolateDiagMiddleware } from "../../_common/isolateDiag.js"
import { Env } from "../../_common/env.js"
import { sentryOptions } from "../../_common/sentry.js"
import * as cachedQueries from "../../api/search/cached-queries.js"
import * as search from "../../api/search/index.js"

// A standalone Worker serving the search endpoints on production, so they
// don't share the Pages Worker's cold start: every new Pages isolate loads the
// whole Functions bundle, chart rendering included (~0.6 s), while a Worker
// holding only these handlers loads a third of that code. See
// https://github.com/owid/owid-grapher/issues/7855.
//
// The handlers are the Pages Functions themselves, called through a minimal
// Pages context, so there is one implementation. The Pages routes stay in
// place for `wrangler pages dev` (local development and staging servers).
// Cloudflare previews call this Worker's per-branch preview URL instead (see
// wrangler.jsonc).

type Handler = PagesFunction<Env>

const ROUTES: Record<string, Partial<Record<string, Handler>>> = {
    "/api/search/cached-queries": {
        POST: cachedQueries.onRequestPost,
        OPTIONS: cachedQueries.onRequestOptions,
    },
    "/api/search": {
        GET: search.onRequestGet,
    },
}

// /api/search reads /topicTagGraph.json through the ASSETS binding, which a
// standalone Worker doesn't have, so it's fetched from the site instead. The
// origin is fixed rather than taken from the request, which under `wrangler
// dev` is this Worker itself.
const SITE_ORIGIN = "https://ourworldindata.org"

const siteAssets: Env["ASSETS"] = {
    fetch: (input, init) => {
        const { pathname, search } = new URL(
            input instanceof Request ? input.url : input
        )
        // Set the parts rather than resolving pathname against the origin,
        // which would read a "//host/..." path as another host.
        const url = new URL(SITE_ORIGIN)
        url.pathname = pathname
        url.search = search
        return fetch(url, init)
    },
}

async function handle(
    request: Request<unknown, IncomingRequestCfProperties>,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    const { pathname } = new URL(request.url)
    const methods = ROUTES[pathname.replace(/\/$/, "")]
    if (!methods) return new Response("Not found", { status: 404 })
    const handler = methods[request.method]
    if (!handler)
        return new Response("Method not allowed", {
            status: 405,
            headers: { Allow: Object.keys(methods).join(", ") },
        })

    // The parts of a Pages context our handlers and middleware use.
    const context: Omit<
        EventContext<Env, string, Record<string, unknown>>,
        "next"
    > = {
        request,
        env: { ...env, ASSETS: siteAssets },
        params: {},
        data: {},
        functionPath: pathname,
        waitUntil: (promise) => ctx.waitUntil(promise),
        passThroughOnException: () => ctx.passThroughOnException(),
    }
    // Same per-request middleware as in Pages, minus the HTML-only ones
    // (experiments, ASN data layer): the opt-in isolate stamp and sampled GA4
    // invocation events.
    return isolateDiagMiddleware({
        ...context,
        next: async () =>
            analyticsMiddleware({
                ...context,
                next: async () =>
                    handler({
                        ...context,
                        next: async () => {
                            throw new Error("Search handlers don't call next()")
                        },
                    }),
            }),
    })
}

export default Sentry.withSentry(sentryOptions, { fetch: handle })
