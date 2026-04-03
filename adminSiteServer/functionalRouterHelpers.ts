import { FunctionalRouter } from "./FunctionalRouter.js"
import { HonoContext } from "./authentication.js"
import * as db from "../db/db.js"

export function getRouteWithROTransaction<T>(
    router: FunctionalRouter,
    targetPath: string,
    handler: (c: HonoContext, trx: db.KnexReadonlyTransaction) => Promise<T>
) {
    return router.get(targetPath, (c) => {
        return db.knexReadonlyTransaction((trx) => handler(c, trx))
    })
}

export function getRouteNonIdempotentWithRWTransaction<T>(
    router: FunctionalRouter,
    targetPath: string,
    handler: (c: HonoContext, trx: db.KnexReadWriteTransaction) => Promise<T>
) {
    return router.get(targetPath, (c) => {
        return db.knexReadWriteTransaction((trx) => handler(c, trx))
    })
}

export function postRouteWithRWTransaction<T>(
    router: FunctionalRouter,
    targetPath: string,
    handler: (c: HonoContext, trx: db.KnexReadWriteTransaction) => Promise<T>
) {
    return router.post(targetPath, (c) => {
        return db.knexReadWriteTransaction((trx) => handler(c, trx))
    })
}

export function postFileUploadWithRWTransaction<T>(
    router: FunctionalRouter,
    targetPath: string,
    handler: (c: HonoContext, trx: db.KnexReadWriteTransaction) => Promise<T>
) {
    return router.postWithFileUpload(targetPath, (c) => {
        return db.knexReadWriteTransaction((trx) => handler(c, trx))
    })
}

export function putRouteWithRWTransaction<T>(
    router: FunctionalRouter,
    targetPath: string,
    handler: (c: HonoContext, trx: db.KnexReadWriteTransaction) => Promise<T>
) {
    return router.put(targetPath, (c) => {
        return db.knexReadWriteTransaction((trx) => handler(c, trx))
    })
}

export function patchRouteWithRWTransaction<T>(
    router: FunctionalRouter,
    targetPath: string,
    handler: (c: HonoContext, trx: db.KnexReadWriteTransaction) => Promise<T>
) {
    return router.patch(targetPath, (c) => {
        return db.knexReadWriteTransaction((trx) => handler(c, trx))
    })
}

export function deleteRouteWithRWTransaction<T>(
    router: FunctionalRouter,
    targetPath: string,
    handler: (c: HonoContext, trx: db.KnexReadWriteTransaction) => Promise<T>
) {
    return router.delete(targetPath, (c) => {
        return db.knexReadWriteTransaction((trx) => handler(c, trx))
    })
}
