import { FunctionalRouter } from "./utils/FunctionalRouter"
import { Request, Response } from "./utils/authentication"
import { writeVariableCSV } from "db/model/Variable"
import { expectInt } from "utils/server/serverUtil"

export const publicApiRouter = new FunctionalRouter()

publicApiRouter.router.get(
    "/variables/:variableIds.csv",
    async (req: Request, res: Response) => {
        const variableIds = req.params.variableIds.split("+").map(expectInt)
        try {
            await writeVariableCSV(variableIds, res)
            res.end()
        } catch (error) {
            res.send(`Error: ${error.message}`)
        }
    }
)
