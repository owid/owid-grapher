import { FunctionalRouter } from "./FunctionalRouter.js"
import { Request, Response } from "./authentication.js"
import { writeVariableCSV } from "../db/model/Variable.js"
import { expectInt } from "../serverUtils/serverUtil.js"
import { stringifyUnkownError } from "../clientUtils/Util.js"

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
