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

// Might be needed in the future if we have get requests that e.g. write analytics data or stats to the DB
// function getRouteWithRWTransaction<T>(
//     targetPath: string,
//     handler: (
//         req: Request,
//         res: Response,
//         trx: db.KnexReadWriteTransaction
//     ) => Promise<T>
// ) {
//     return apiRouter.get(targetPath, (req: Request, res: Response) => {
//         return db.knexReadWriteTransaction((transaction) =>
//             handler(req, res, transaction)
//         )
//     })
// }

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
