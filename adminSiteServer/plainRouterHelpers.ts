import { NextFunction, Request, Response, Router } from "express"
import * as db from "../db/db.js"
export function getPlainRouteWithROTransaction<T>(
    router: Router,
    targetPath: string,
    handler: (
        req: Request,
        res: Response,
        trx: db.KnexReadonlyTransaction,
        next?: NextFunction
    ) => Promise<T>
) {
    return router.get(
        targetPath,
        (req: Request, res: Response, nxt: NextFunction) => {
            return db.knexReadonlyTransaction((transaction) =>
                handler(req, res, transaction, nxt)
            )
        }
    )
}

/** Usually get routes should be idempotent (caching and retry reasons among others),
    but for example the gdoc preview route is not because it updates the gdoc in the DB after
    fetching it from the google API.
 */
export function getPlainRouteNonIdempotentWithRWTransaction<T>(
    router: Router,
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

export function postPlainRouteWithRWTransaction<T>(
    router: Router,
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

export function putPlainRouteWithRWTransaction<T>(
    router: Router,
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

export function patchPlainRouteWithRWTransaction<T>(
    router: Router,
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

export function deletePlainRouteWithRWTransaction<T>(
    router: Router,
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
