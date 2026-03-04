import { Request } from "express"
import { HandlerResponse } from "../FunctionalRouter.js"
import { JsonError } from "@ourworldindata/utils"
import * as db from "../../db/db.js"
import { getChartConfigById } from "../../db/model/ChartConfigs.js"

export async function getChartConfig(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const { chartConfigId } = req.params
    const config = await getChartConfigById(trx, chartConfigId)
    if (config) return config
    throw new JsonError(`No chart config found for id ${chartConfigId}`, 404)
}
