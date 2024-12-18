import {
    DbPlainChart,
    DbRawChartConfig,
    GrapherInterface,
    DbRawVariable,
} from "@ourworldindata/types"
import { parseIntOrUndefined } from "@ourworldindata/utils"
import {
    BulkGrapherConfigResponse,
    BulkChartEditResponseRow,
    chartBulkUpdateAllowedColumnNamesAndTypes,
    GrapherConfigPatch,
    VariableAnnotationsResponseRow,
    variableAnnotationAllowedColumnNamesAndTypes,
} from "../../adminShared/AdminSessionTypes.js"
import { applyPatch } from "../../adminShared/patchHelper.js"
import {
    OperationContext,
    parseToOperation,
} from "../../adminShared/SqlFilterSExpression.js"
import {
    getGrapherConfigsForVariable,
    updateGrapherConfigAdminOfVariable,
} from "../../db/model/Variable.js"
import {
    getRouteWithROTransaction,
    patchRouteWithRWTransaction,
} from "../functionalRouterHelpers.js"
import { saveGrapher } from "./charts.js"
import * as db from "../../db/db.js"
import * as lodash from "lodash"
import { apiRouter } from "../apiRouter.js"

getRouteWithROTransaction(
    apiRouter,
    "/chart-bulk-update",
    async (
        req,
        res,
        trx
    ): Promise<BulkGrapherConfigResponse<BulkChartEditResponseRow>> => {
        const context: OperationContext = {
            grapherConfigFieldName: "chart_configs.full",
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
                    chart_configs.full as config,
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
)

patchRouteWithRWTransaction(
    apiRouter,
    "/chart-bulk-update",
    async (req, res, trx) => {
        const patchesList = req.body as GrapherConfigPatch[]
        const chartIds = new Set(patchesList.map((patch) => patch.id))

        const configsAndIds = await db.knexRaw<
            Pick<DbPlainChart, "id"> & { config: DbRawChartConfig["full"] }
        >(
            trx,
            `-- sql
                SELECT c.id, cc.full as config
                FROM charts c
                JOIN chart_configs cc ON cc.id = c.configId
                WHERE c.id IN (?)
            `,
            [[...chartIds.values()]]
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
                referencedVariablesMightChange: false,
            })
        }

        return { success: true }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/variable-annotations",
    async (
        req,
        res,
        trx
    ): Promise<BulkGrapherConfigResponse<VariableAnnotationsResponseRow>> => {
        const context: OperationContext = {
            grapherConfigFieldName: "grapherConfigAdmin",
            whitelistedColumnNamesAndTypes:
                variableAnnotationAllowedColumnNamesAndTypes,
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
                    variables.id as id,
                    variables.name as name,
                    chart_configs.patch as config,
                    d.name as datasetname,
                    namespaces.name as namespacename,
                    variables.createdAt as createdAt,
                    variables.updatedAt as updatedAt,
                    variables.description as description
                FROM variables
                LEFT JOIN active_datasets as d on variables.datasetId = d.id
                LEFT JOIN namespaces on d.namespace = namespaces.name
                LEFT JOIN chart_configs on variables.grapherConfigIdAdmin = chart_configs.id
                WHERE ${whereClause}
                ORDER BY variables.id DESC
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
                FROM variables
                LEFT JOIN active_datasets as d on variables.datasetId = d.id
                LEFT JOIN namespaces on d.namespace = namespaces.name
                LEFT JOIN chart_configs on variables.grapherConfigIdAdmin = chart_configs.id
                WHERE ${whereClause}
            `
        )
        return { rows: results, numTotalRows: resultCount[0].count }
    }
)

patchRouteWithRWTransaction(
    apiRouter,
    "/variable-annotations",
    async (req, res, trx) => {
        const patchesList = req.body as GrapherConfigPatch[]
        const variableIds = new Set(patchesList.map((patch) => patch.id))

        const configsAndIds = await db.knexRaw<
            Pick<DbRawVariable, "id"> & {
                grapherConfigAdmin: DbRawChartConfig["patch"]
            }
        >(
            trx,
            `-- sql
              SELECT v.id, cc.patch AS grapherConfigAdmin
              FROM variables v
              LEFT JOIN chart_configs cc ON v.grapherConfigIdAdmin = cc.id
              WHERE v.id IN (?)
          `,
            [[...variableIds.values()]]
        )
        const configMap = new Map(
            configsAndIds.map((item: any) => [
                item.id,
                item.grapherConfigAdmin
                    ? JSON.parse(item.grapherConfigAdmin)
                    : {},
            ])
        )
        // console.log("ids", configsAndIds.map((item : any) => item.id))
        for (const patchSet of patchesList) {
            const config = configMap.get(patchSet.id)
            configMap.set(patchSet.id, applyPatch(patchSet, config))
        }

        for (const [variableId, newConfig] of configMap.entries()) {
            const variable = await getGrapherConfigsForVariable(trx, variableId)
            if (!variable) continue
            await updateGrapherConfigAdminOfVariable(trx, variable, newConfig)
        }

        return { success: true }
    }
)
