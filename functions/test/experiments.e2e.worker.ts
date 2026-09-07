import { Experiment } from "@ourworldindata/utils"
import { experimentsMiddleware } from "../_common/experiments.js"
import type { Env } from "../_common/env.js"

/*
 * Test worker for the experiments middleware.
 *
 * Runs the middleware in workerd — the only place HTMLRewriter exists — over
 * a canned HTML response, with a fixed experiment list so the assertions
 * don't depend on which experiments are live.
 *
 * `forced` has a single arm at fraction 1, so a random assignment can only
 * ever produce `assigned`: any other arm in the response proves the override
 * (or the incoming cookie) was honoured rather than the dice roll.
 */
const TEST_EXPERIMENTS = [
    new Experiment({
        id: "test-v1",
        expires: new Date(Date.now() + 864e5).toISOString(),
        arms: [
            { id: "assigned", fraction: 1 },
            { id: "forced", fraction: 0 },
        ],
        paths: ["/test-page"],
    }),
]

const HTML = `<!doctype html><html><body class="page"><p>hi</p></body></html>`

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const context = {
            request,
            env,
            params: {},
            data: {} as Record<string, unknown>,
            functionPath: new URL(request.url).pathname,
            waitUntil: () => {
                // no-op for tests
            },
            passThroughOnException: () => {
                // no-op for tests
            },
            next: async () =>
                new Response(HTML, {
                    headers: { "content-type": "text/html; charset=utf-8" },
                }),
        } as unknown as EventContext<Env, string, Record<string, unknown>>

        return experimentsMiddleware(context, TEST_EXPERIMENTS)
    },
}
