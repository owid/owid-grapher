import e from "express"
import { FunctionalRouter } from "./FunctionalRouter.js"
import { Request, Response } from "./authentication.js"
import * as db from "../db/db.js"
import { getNarrativeChartNameConfigMap } from "../db/model/NarrativeChart.js"
import { getRouteWithROTransaction } from "./functionalRouterHelpers.js"

export const publicApiRouter = new FunctionalRouter()

function rejectAfterDelay(ms: number) {
    return new Promise((resolve, reject) => setTimeout(reject, ms))
}

publicApiRouter.router.get("/health", async (req: Request, res: Response) => {
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

getRouteWithROTransaction(
    publicApiRouter,
    "/narrative-chart-map",
    async (
        _req: Request,
        _res: e.Response<any, Record<string, any>>,
        trx: db.KnexReadonlyTransaction
    ) => {
        const narrativeChartMap = await getNarrativeChartNameConfigMap(trx)
        return narrativeChartMap
    }
)
