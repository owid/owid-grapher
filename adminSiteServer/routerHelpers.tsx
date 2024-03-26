import { FunctionalRouter } from "./FunctionalRouter.js"
import { Request, Response } from "express"
import * as db from "../db/db.js"
export function getRouteWithROTransaction<T>(
    router: FunctionalRouter,
    targetPath: string,
    handler: (
        req: Request,
        res: Response,
        trx: db.KnexReadonlyTransaction
    ) => Promise<T>
) {
    return router.get(targetPath, (req: Request, res: Response) => {
        return db.knexReadonlyTransaction((transaction) =>
            handler(req, res, transaction)
        )
    })
}

/** Usually get routes should be idempotent (caching and retry reasons among others),
    but for example the gdoc preview route is not because it updates the gdoc in the DB after
    fetching it from the google API.
 */
export function getRouteNonIdempotentWithRWTransaction<T>(
    router: FunctionalRouter,
    targetPath: string,
    handler: (
        req: Request,
        res: Response,
        trx: db.KnexReadWriteTransaction
    ) => Promise<T>
) {
    return router.get(targetPath, (req: Request, res: Response) => {
        return db.knexReadWriteTransaction((transaction) =>
            handler(req, res, transaction)
        )
    })
}

export function postRouteWithRWTransaction<T>(
    router: FunctionalRouter,
    targetPath: string,
    handler: (
        req: Request,
        res: Response,
        trx: db.KnexReadWriteTransaction
    ) => Promise<T>
) {
    return router.post(targetPath, (req: Request, res: Response) => {
        return db.knexReadWriteTransaction((transaction) =>
            handler(req, res, transaction)
        )
    })
}

export function putRouteWithRWTransaction<T>(
    router: FunctionalRouter,
    targetPath: string,
    handler: (
        req: Request,
        res: Response,
        trx: db.KnexReadWriteTransaction
    ) => Promise<T>
) {
    return router.put(targetPath, (req: Request, res: Response) => {
        return db.knexReadWriteTransaction((transaction) =>
            handler(req, res, transaction)
        )
    })
}

export function patchRouteWithRWTransaction<T>(
    router: FunctionalRouter,
    targetPath: string,
    handler: (
        req: Request,
        res: Response,
        trx: db.KnexReadWriteTransaction
    ) => Promise<T>
) {
    return router.patch(targetPath, (req: Request, res: Response) => {
        return db.knexReadWriteTransaction((transaction) =>
            handler(req, res, transaction)
        )
    })
}

export function deleteRouteWithRWTransaction<T>(
    router: FunctionalRouter,
    targetPath: string,
    handler: (
        req: Request,
        res: Response,
        trx: db.KnexReadWriteTransaction
    ) => Promise<T>
) {
    return router.delete(targetPath, (req: Request, res: Response) => {
        return db.knexReadWriteTransaction((transaction) =>
            handler(req, res, transaction)
        )
    })
}
