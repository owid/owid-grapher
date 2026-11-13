import {
    cors,
    type ErrorHandler,
    type IRequestStrict,
    type RequestHandler,
    // oxlint-disable-next-line eslint/no-restricted-imports -- this is the one place that may create routers
    Router,
    type RouterType,
    type StatusError,
} from "itty-router"
import { errorToResponse } from "./errorHandling.js"

const { preflight, corsify } = cors({
    allowMethods: ["GET", "OPTIONS", "HEAD"],
})

/**
 * Creates the itty-router for a route file, so that every route answers CORS
 * preflights, adds CORS headers to all responses (including error ones), and
 * reports unexpected errors to Sentry (see errorToResponse).
 *
 * Errors are handled in the router's `catch` rather than left to
 * errorResponseMiddleware, because itty-router only applies `finally` (and so
 * `corsify`) to responses produced inside the router.
 */
export function createRouter<Args extends any[]>(
    options: {
        /** Runs after the CORS preflight, before the routes */
        before?: RequestHandler<IRequestStrict, Args>[]
        /** Replaces errorToResponse; should end by delegating to it */
        catch?: ErrorHandler<StatusError, IRequestStrict, Args>
    } = {}
): RouterType<IRequestStrict, Args> {
    // The wrappers' rest params are needed for TS to accept handlers that
    // ignore the generic route args
    return Router<IRequestStrict, Args>({
        before: [
            (request: IRequestStrict, ..._args: Args) => preflight(request),
            ...(options.before ?? []),
        ],
        catch:
            options.catch ??
            ((e: unknown, _request: IRequestStrict, ..._args: Args) =>
                errorToResponse(e)),
        finally: [
            (response: Response, request: IRequestStrict, ..._args: Args) =>
                corsify(response, request),
        ],
    })
}
