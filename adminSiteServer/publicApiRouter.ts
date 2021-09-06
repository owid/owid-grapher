import { FunctionalRouter } from "./FunctionalRouter"
import { Request, Response } from "./authentication"
import { writeVariableCSV } from "../db/model/Variable"
import { expectInt } from "./serverUtil"
import { stringifyUnkownError } from "../clientUtils/Util"

export const publicApiRouter = new FunctionalRouter()

publicApiRouter.router.get(
    "/variables/:variableIds.csv",
    async (req: Request, res: Response) => {
        const variableIds = req.params.variableIds.split("+").map(expectInt)
        try {
            await writeVariableCSV(variableIds, res)
            res.end()
        } catch (error) {
            res.send(`Error: ${stringifyUnkownError(error)}`)
        }
    }
)
