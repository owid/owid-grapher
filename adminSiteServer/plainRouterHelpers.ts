import { Hono, Context, Next } from "hono"
import * as db from "../db/db.js"
import {
    CompatRequest,
    FullResponse,
    buildCompatRequest,
    buildFullResponse,
    parseBody,
} from "./FunctionalRouter.js"
import { AppVariables } from "./authentication.js"

type HonoApp = Hono<{ Variables: AppVariables }>

async function wrapPlainHandler<T>(
    c: Context<{ Variables: AppVariables }>,
    handler: (
        req: CompatRequest,
        res: FullResponse,
        trx: any,
        next?: Next
    ) => Promise<T>,
    transactionFn: (cb: (trx: any) => Promise<T>) => Promise<T>,
    next?: Next
): Promise<Response> {
    const body = await parseBody(c)
    const req = buildCompatRequest(c as any, body)
    const responseState = {
        body: undefined as string | object | undefined,
        statusCode: 200,
    }
    const res = buildFullResponse(c as any, responseState)

    await transactionFn((transaction) => handler(req, res, transaction, next))

    if (
        responseState.body &&
        typeof responseState.body === "object" &&
        "__redirect" in responseState.body
    ) {
        return c.redirect((responseState.body as any).__redirect)
    }

    if (typeof responseState.body === "object") {
        return c.json(responseState.body, responseState.statusCode as any)
    }

    return c.html(responseState.body || "", responseState.statusCode as any)
}

export function getPlainRouteWithROTransaction<T>(
    router: HonoApp,
    targetPath: string,
    handler: (
        req: CompatRequest,
        res: FullResponse,
        trx: db.KnexReadonlyTransaction,
        next?: Next
    ) => Promise<T>
) {
    return router.get(targetPath, async (c, next) => {
        return wrapPlainHandler(c, handler, db.knexReadonlyTransaction, next)
    })
}

/** Usually get routes should be idempotent (caching and retry reasons among others),
    but for example the gdoc preview route is not because it updates the gdoc in the DB after
    fetching it from the google API.
 */
export function getPlainRouteNonIdempotentWithRWTransaction<T>(
    router: HonoApp,
    targetPath: string,
    handler: (
        req: CompatRequest,
        res: FullResponse,
        trx: db.KnexReadWriteTransaction
    ) => Promise<T>
) {
    return router.get(targetPath, async (c) => {
        return wrapPlainHandler(c, handler, db.knexReadWriteTransaction)
    })
}

export function postPlainRouteWithRWTransaction<T>(
    router: HonoApp,
    targetPath: string,
    handler: (
        req: CompatRequest,
        res: FullResponse,
        trx: db.KnexReadWriteTransaction
    ) => Promise<T>
) {
    return router.post(targetPath, async (c) => {
        return wrapPlainHandler(c, handler, db.knexReadWriteTransaction)
    })
}

export function putPlainRouteWithRWTransaction<T>(
    router: HonoApp,
    targetPath: string,
    handler: (
        req: CompatRequest,
        res: FullResponse,
        trx: db.KnexReadWriteTransaction
    ) => Promise<T>
) {
    return router.put(targetPath, async (c) => {
        return wrapPlainHandler(c, handler, db.knexReadWriteTransaction)
    })
}

export function patchPlainRouteWithRWTransaction<T>(
    router: HonoApp,
    targetPath: string,
    handler: (
        req: CompatRequest,
        res: FullResponse,
        trx: db.KnexReadWriteTransaction
    ) => Promise<T>
) {
    return router.patch(targetPath, async (c) => {
        return wrapPlainHandler(c, handler, db.knexReadWriteTransaction)
    })
}

export function deletePlainRouteWithRWTransaction<T>(
    router: HonoApp,
    targetPath: string,
    handler: (
        req: CompatRequest,
        res: FullResponse,
        trx: db.KnexReadWriteTransaction
    ) => Promise<T>
) {
    return router.delete(targetPath, async (c) => {
        return wrapPlainHandler(c, handler, db.knexReadWriteTransaction)
    })
}
