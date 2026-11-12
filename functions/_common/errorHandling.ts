import * as Sentry from "@sentry/cloudflare"
import { error, StatusError } from "itty-router"
import { Env } from "./env.js"

/**
 * Turns exceptions thrown while handling a request into error responses, as
 * the backstop for everything that doesn't handle them itself.
 *
 * Handlers signal expected failures (an unknown chart, a bad query param, a
 * forbidden download, ...) by throwing an itty-router `StatusError` with a
 * 4xx status, and let every other exception propagate. Don't catch an
 * exception just to return a 500: the Sentry plugin only sees exceptions that
 * propagate, so that would hide the failure.
 *
 * Routers pass `errorToResponse` as their `catch` option instead of letting
 * exceptions reach this middleware, so that their `finally` handlers (e.g.
 * `corsify`) also apply to error responses.
 */
export const errorResponseMiddleware: PagesFunction<Env> = async (context) => {
    try {
        return await context.next()
    } catch (e) {
        return errorToResponse(e)
    }
}

export function errorToResponse(e: unknown): Response {
    if (e instanceof StatusError && e.status < 500) return error(e)
    console.error("Unhandled error", e)
    Sentry.captureException(e)
    // Don't expose internal error messages
    return error(e instanceof StatusError ? e.status : 500)
}
