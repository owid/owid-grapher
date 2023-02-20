import { FunctionalRouter } from "./FunctionalRouter.js"
import { Request, Response } from "./authentication.js"
import { writeVariableCSV } from "../db/model/Variable.js"
import { expectInt } from "../serverUtils/serverUtil.js"
import * as db from "../db/db.js"
import { stringifyUnkownError } from "@ourworldindata/utils"
import { Writable } from "stream"

export const publicApiRouter = new FunctionalRouter()

function rejectAfterDelay(ms: number) {
    return new Promise((resolve, reject) => setTimeout(reject, ms))
}
publicApiRouter.router.get(
    "/variables/:variableIds.csv",
    async (req: Request, res: Response) => {
        const variableIds = req.params.variableIds.split("+").map(expectInt)
        try {
            const writeStream = new Writable({
                write(chunk, encoding, callback) {
                    res.write(chunk.toString())
                    callback(null)
                },
            })
            await writeVariableCSV(variableIds, writeStream)
            res.end()
        } catch (error) {
            res.send(`Error: ${stringifyUnkownError(error)}`)
        }
    }
)

publicApiRouter.router.get("/health", async (req: Request, res: Response) => {
    const sqlPromise = db.mysqlFirst(`SELECT id FROM charts LIMIT 1`)
    const timeoutPromise = rejectAfterDelay(1500) // Wait 1.5 seconds at most
    try {
        await Promise.race([sqlPromise, timeoutPromise])
        res.status(200).end("OK")
    } catch (e) {
        res.status(500).end("Error querying the database")
        console.error("Error at health endpoint", e)
    }
})
