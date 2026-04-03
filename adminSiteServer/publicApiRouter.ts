import { FunctionalRouter } from "./FunctionalRouter.js"
import { HonoContext } from "./authentication.js"
import * as db from "../db/db.js"
import { getNarrativeChartNameConfigMap } from "../db/model/NarrativeChart.js"
import { getRouteWithROTransaction } from "./functionalRouterHelpers.js"

export const publicApiRouter = new FunctionalRouter()

function rejectAfterDelay(ms: number) {
    return new Promise((resolve, reject) => setTimeout(reject, ms))
}

publicApiRouter.app.get("/health", async (c) => {
    try {
        const sqlPromise = db.knexRaw(
            db.knexInstance() as db.KnexReadonlyTransaction,
            `SELECT id FROM charts LIMIT 1`
        )
        const timeoutPromise = rejectAfterDelay(1500) // Wait 1.5 seconds at most
        await Promise.race([sqlPromise, timeoutPromise])
        return c.text("OK", 200)
    } catch (e) {
        console.error("Error at health endpoint", e)
        return c.text("Error querying the database", 500)
    }
})

getRouteWithROTransaction(
    publicApiRouter,
    "/narrative-chart-map",
    async (_c: HonoContext, trx: db.KnexReadonlyTransaction) => {
        const narrativeChartMap = await getNarrativeChartNameConfigMap(trx)
        return narrativeChartMap
    }
)
