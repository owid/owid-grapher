import { Experiment } from "@ourworldindata/utils"
import { experimentsMiddleware } from "../_common/experiments.js"
import { handleExperimentSwitcher } from "../exp/index.js"
import type { Env } from "../_common/env.js"

/*
 * Test worker for the experiment middleware and the `/exp` switcher.
 *
 * Runs both in workerd — the only place HTMLRewriter exists — over a canned
 * HTML response, with a fixed experiment list so the assertions don't depend
 * on which experiments are live.
 *
 * `forced` has fraction 0, so a random assignment can only ever produce
 * `assigned`: seeing any other arm proves the incoming cookie was honoured
 * rather than the dice roll.
 *
 * `/exp-in-production` is the same switcher with `ENV` forced to
 * `production`, so the environment gate can be tested without booting a
 * second workerd. Its `ASSETS` stub stands in for the baked site, which is
 * what the switcher hands production requests to.
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
        const { pathname } = new URL(request.url)

        if (pathname === "/exp")
            return handleExperimentSwitcher(request, env, TEST_EXPERIMENTS)

        if (pathname === "/exp-in-production")
            return handleExperimentSwitcher(
                request,
                {
                    ...env,
                    ENV: "production",
                    ASSETS: {
                        fetch: async () =>
                            new Response("baked assets", { status: 404 }),
                    } as unknown as Fetcher,
                },
                TEST_EXPERIMENTS
            )

        const context = {
            request,
            env,
            params: {},
            data: {} as Record<string, unknown>,
            functionPath: pathname,
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
