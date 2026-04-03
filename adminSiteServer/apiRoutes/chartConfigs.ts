import { HonoContext } from "../authentication.js"
import { JsonError } from "@ourworldindata/utils"
import * as db from "../../db/db.js"
import { getChartConfigById } from "../../db/model/ChartConfigs.js"

export async function getChartConfig(
    c: HonoContext,
    trx: db.KnexReadonlyTransaction
) {
    const chartConfigId = c.req.param("chartConfigId")!
    const config = await getChartConfigById(trx, chartConfigId)
    if (config) return config
    throw new JsonError(`No chart config found for id ${chartConfigId}`, 404)
}
