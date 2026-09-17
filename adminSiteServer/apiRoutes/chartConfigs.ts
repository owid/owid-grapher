import { Request } from "express"
import * as z from "zod"
import { HandlerResponse } from "../FunctionalRouter.js"
import { JsonError } from "@ourworldindata/utils"
import * as db from "../../db/db.js"
import { getChartConfigByUuid } from "../../db/model/ChartConfigs.js"
import {
    GrapherConfigValidationIssue,
    tryIngestGrapherConfig,
} from "../../db/grapherConfigValidation.js"

export async function getChartConfig(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const { chartConfigId } = req.params
    const config = await getChartConfigByUuid(trx, chartConfigId)
    if (config) return config
    throw new JsonError(`No chart config found for id ${chartConfigId}`, 404)
}

export type ChartConfigValidationResult =
    | { isValid: true }
    | { isValid: false; issues: GrapherConfigValidationIssue[] }

export interface ChartConfigValidationReport {
    results: ChartConfigValidationResult[]
}

const validateChartConfigsSchema = z.object({
    configs: z.array(z.unknown()),
})

export async function validateChartConfigs(
    req: Request
): Promise<ChartConfigValidationReport> {
    const parseResult = validateChartConfigsSchema.safeParse(req.body)
    if (!parseResult.success)
        throw new JsonError(`Invalid request: ${parseResult.error}`, 400)

    const results = parseResult.data.configs.map(toValidationResult)
    return { results }
}

function toValidationResult(config: unknown): ChartConfigValidationResult {
    const ingestResult = tryIngestGrapherConfig(config)
    if (ingestResult.isValid) return { isValid: true }
    return { isValid: false, issues: ingestResult.issues }
}
