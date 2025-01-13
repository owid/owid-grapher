import { Router, Request, Response } from "express"
import * as db from "../db/db.js"

export const publicApiRouter = Router()

function rejectAfterDelay(ms: number) {
    return new Promise((resolve, reject) => setTimeout(reject, ms))
}

publicApiRouter.get("/health", async (req: Request, res: Response) => {
    try {
        const sqlPromise = db.knexRaw(
            db.knexInstance() as db.KnexReadonlyTransaction,
            `SELECT id FROM charts LIMIT 1`
        )
        const timeoutPromise = rejectAfterDelay(1500) // Wait 1.5 seconds at most
        await Promise.race([sqlPromise, timeoutPromise])
        res.status(200).end("OK")
    } catch (e) {
        res.status(500).end("Error querying the database")
        console.error("Error at health endpoint", e)
    }
})
