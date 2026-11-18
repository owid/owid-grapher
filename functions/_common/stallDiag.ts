import { Env } from "./env.js"

// Diagnostic for the parallel-request stall investigation (branch stall-diag,
// not meant to be merged). Stamps every Function response with the isolate that
// served it, so a slow response can be attributed to a freshly started isolate
// (cold start) or to a long-lived one (queueing).
//
// Workers forbid generating random values in global scope, so the isolate id
// is created on the first request. Date.now() only advances on I/O, so `entry`
// is when this isolate started handling the request, and `exit - entry` is the
// I/O time spent in the rest of the middleware chain and the handler.
const MODULE_TIME = Date.now()
let isolateId = ""
let firstRequestAt = 0
let requestCount = 0
let inFlight = 0

export const stallDiagMiddleware: PagesFunction<Env> = async (context) => {
    const entry = Date.now()
    if (!isolateId) {
        isolateId = crypto.randomUUID().slice(0, 8)
        firstRequestAt = entry
    }
    const n = ++requestCount
    const concurrent = ++inFlight
    try {
        const response = await context.next()
        const headers = new Headers(response.headers)
        headers.set(
            "x-owid-diag",
            [
                `iso=${isolateId}`,
                `n=${n}`,
                `inflight=${concurrent}`,
                `mod=${MODULE_TIME}`,
                `first=${firstRequestAt}`,
                `entry=${entry}`,
                `exit=${Date.now()}`,
            ].join(";")
        )
        headers.set("access-control-expose-headers", "x-owid-diag")
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        })
    } finally {
        inFlight--
    }
}
