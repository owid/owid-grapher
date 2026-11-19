import { Env } from "./env.js"

// Opt-in diagnostic: when a request carries `x-owid-diag: 1`, stamp the
// response with which Worker isolate served it, how many requests that isolate
// had received by then (this one and any still running included), and when
// it received its first one. That tells a response from a freshly started
// isolate (a cold start) apart from one served by a long-lived isolate, which
// is what separates the causes of slow Function responses. Every request is
// counted, but only opted-in responses change.
//
// Workers forbid generating random values in global scope, so the isolate id
// is created on the first request. Date.now() only advances on I/O, so `entry`
// is when this isolate started handling the request.
const DIAG_HEADER = "x-owid-diag"

let isolateId = ""
let firstRequestAt = 0
let requestCount = 0

export const isolateDiagMiddleware: PagesFunction<Env> = async (context) => {
    const entry = Date.now()
    if (!isolateId) {
        isolateId = crypto.randomUUID().slice(0, 8)
        firstRequestAt = entry
    }
    const n = ++requestCount

    const response = await context.next()
    if (context.request.headers.get(DIAG_HEADER) !== "1") return response

    try {
        // Passing the original as the init carries over every field, including
        // the Workers-only ones (webSocket, cf), not just status and headers.
        const stamped = new Response(response.body, response)
        stamped.headers.set(
            DIAG_HEADER,
            `iso=${isolateId};n=${n};first=${firstRequestAt};entry=${entry}`
        )
        return stamped
    } catch {
        // Fail open: a diagnostic must never break the response.
        return response
    }
}
