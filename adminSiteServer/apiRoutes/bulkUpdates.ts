import {
    DbPlainChart,
    DbRawChartConfig,
    GrapherInterface,
} from "@ourworldindata/types"
import { parseIntOrUndefined } from "@ourworldindata/utils"
import {
    BulkGrapherConfigResponse,
    BulkChartEditResponseRow,
    chartBulkUpdateAllowedColumnNamesAndTypes,
    GrapherConfigPatch,
} from "../../adminShared/AdminSessionTypes.js"
import { applyPatch } from "../../adminShared/patchHelper.js"
import {
    OperationContext,
    parseToOperation,
} from "../../adminShared/SqlFilterSExpression.js"
import { saveGrapher } from "./charts.js"
import * as db from "../../db/db.js"
import * as lodash from "lodash-es"
import { Request } from "../authentication.js"
import { HandlerResponse } from "../FunctionalRouter.js"

export async function getChartBulkUpdate(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
): Promise<BulkGrapherConfigResponse<BulkChartEditResponseRow>> {
    const context: OperationContext = {
        grapherConfigFieldName: "chart_configs.config",
        whitelistedColumnNamesAndTypes:
            chartBulkUpdateAllowedColumnNamesAndTypes,
    }
    const filterSExpr =
        req.query.filter !== undefined
            ? parseToOperation(req.query.filter as string, context)
            : undefined

    const offset = parseIntOrUndefined(req.query.offset as string) ?? 0

    // Note that our DSL generates sql here that we splice directly into the SQL as text
    // This is a potential for a SQL injection attack but we control the DSL and are
    // careful there to only allow carefully guarded vocabularies from being used, not
    // arbitrary user input
    const whereClause = filterSExpr?.toSql() ?? "true"
    const resultsWithStringGrapherConfigs = await db.knexRaw(
        trx,
        `-- sql
                SELECT
                    charts.id as id,
                    chart_configs.config as config,
                    charts.createdAt as createdAt,
                    charts.updatedAt as updatedAt,
                    charts.lastEditedAt as lastEditedAt,
                    charts.publishedAt as publishedAt,
                    lastEditedByUser.fullName as lastEditedByUser,
                    publishedByUser.fullName as publishedByUser
                FROM charts
                LEFT JOIN chart_configs ON chart_configs.id = charts.configId
                LEFT JOIN users lastEditedByUser ON lastEditedByUser.id=charts.lastEditedByUserId
                LEFT JOIN users publishedByUser ON publishedByUser.id=charts.publishedByUserId
                WHERE ${whereClause}
                ORDER BY charts.id DESC
                LIMIT 50
                OFFSET ${offset.toString()}
            `
    )

    const results = resultsWithStringGrapherConfigs.map((row: any) => ({
        ...row,
        config: lodash.isNil(row.config) ? null : JSON.parse(row.config),
    }))
    const resultCount = await db.knexRaw<{ count: number }>(
        trx,
        `-- sql
                SELECT count(*) as count
                FROM charts
                JOIN chart_configs ON chart_configs.id = charts.configId
                WHERE ${whereClause}
            `
    )
    return { rows: results, numTotalRows: resultCount[0].count }
}

export async function updateBulkChartConfigs(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const patchesList = req.body as GrapherConfigPatch[]
    const chartIds = new Set(patchesList.map((patch) => patch.id))

    const configsAndIds = await db.knexRaw<
        Pick<DbPlainChart, "id"> & { config: DbRawChartConfig["config"] }
    >(
        trx,
        `-- sql
            SELECT c.id, cc.config as config
            FROM charts c
            JOIN chart_configs cc ON cc.id = c.configId
            WHERE c.id IN (?)
        `,
        [chartIds.values().toArray()]
    )
    const configMap = new Map<number, GrapherInterface>(
        configsAndIds.map((item: any) => [
            item.id,
            // make sure that the id is set, otherwise the update behaviour is weird
            // TODO: discuss if this has unintended side effects
            item.config ? { ...JSON.parse(item.config), id: item.id } : {},
        ])
    )
    const oldValuesConfigMap = new Map(configMap)
    // console.log("ids", configsAndIds.map((item : any) => item.id))
    for (const patchSet of patchesList) {
        const config = configMap.get(patchSet.id)
        configMap.set(patchSet.id, applyPatch(patchSet, config))
    }

    for (const [id, newConfig] of configMap.entries()) {
        await saveGrapher(trx, {
            user: res.locals.user,
            newConfig,
            existingConfig: oldValuesConfigMap.get(id),
        })
    }

    return { success: true }
}
