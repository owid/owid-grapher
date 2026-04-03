import { Hono, Next } from "hono"
import * as db from "../db/db.js"
import { AppVariables, HonoContext } from "./authentication.js"

type HonoApp = Hono<{ Variables: AppVariables }>

export function getPlainRouteWithROTransaction(
    router: HonoApp,
    targetPath: string,
    handler: (
        c: HonoContext,
        trx: db.KnexReadonlyTransaction,
        next: Next
    ) => Promise<Response | void>
) {
    return router.get(targetPath, async (c, next) => {
        return db.knexReadonlyTransaction((trx) =>
            handler(c as HonoContext, trx, next)
        )
    })
}

export function getPlainRouteNonIdempotentWithRWTransaction(
    router: HonoApp,
    targetPath: string,
    handler: (
        c: HonoContext,
        trx: db.KnexReadWriteTransaction
    ) => Promise<Response | void>
) {
    return router.get(targetPath, async (c) => {
        return db.knexReadWriteTransaction((trx) =>
            handler(c as HonoContext, trx)
        )
    })
}

export function postPlainRouteWithRWTransaction(
    router: HonoApp,
    targetPath: string,
    handler: (
        c: HonoContext,
        trx: db.KnexReadWriteTransaction
    ) => Promise<Response | void>
) {
    return router.post(targetPath, async (c) => {
        return db.knexReadWriteTransaction((trx) =>
            handler(c as HonoContext, trx)
        )
    })
}

export function putPlainRouteWithRWTransaction(
    router: HonoApp,
    targetPath: string,
    handler: (
        c: HonoContext,
        trx: db.KnexReadWriteTransaction
    ) => Promise<Response | void>
) {
    return router.put(targetPath, async (c) => {
        return db.knexReadWriteTransaction((trx) =>
            handler(c as HonoContext, trx)
        )
    })
}

export function patchPlainRouteWithRWTransaction(
    router: HonoApp,
    targetPath: string,
    handler: (
        c: HonoContext,
        trx: db.KnexReadWriteTransaction
    ) => Promise<Response | void>
) {
    return router.patch(targetPath, async (c) => {
        return db.knexReadWriteTransaction((trx) =>
            handler(c as HonoContext, trx)
        )
    })
}

export function deletePlainRouteWithRWTransaction(
    router: HonoApp,
    targetPath: string,
    handler: (
        c: HonoContext,
        trx: db.KnexReadWriteTransaction
    ) => Promise<Response | void>
) {
    return router.delete(targetPath, async (c) => {
        return db.knexReadWriteTransaction((trx) =>
            handler(c as HonoContext, trx)
        )
    })
}
