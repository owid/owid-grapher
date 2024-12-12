import { ChartViewMetadata, JsonString } from "@ourworldindata/types"
import * as db from "../db.js"

export const getChartViewsMetadata = async (
    knex: db.KnexReadonlyTransaction,
    names?: string[]
): Promise<ChartViewMetadata[]> => {
    type RawRow = Omit<ChartViewMetadata, "queryParamsForParentChart"> & {
        queryParamsForParentChart: JsonString
    }
    let rows: RawRow[]

    const query = `-- sql
SELECT cv.name,
       cc.full ->> "$.title" as title,
       chartConfigId,
       pcc.slug as parentChartSlug,
       cv.queryParamsForParentChart
FROM chart_views cv
JOIN chart_configs cc on cc.id = cv.chartConfigId
JOIN charts pc on cv.parentChartId = pc.id
JOIN chart_configs pcc on pc.configId = pcc.id
        `

    if (names) {
        if (names.length === 0) return []
        rows = await db.knexRaw(knex, `${query} WHERE cv.name IN (?)`, [names])
    } else rows = await db.knexRaw(knex, query)

    return rows.map((row) => ({
        ...row,
        queryParamsForParentChart: JSON.parse(row.queryParamsForParentChart),
    }))
}
