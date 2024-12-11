import { ChartViewMetadata, JsonString } from "@ourworldindata/types"
import * as db from "../db.js"

export const getAllChartViewsMetadata = async (
    knex: db.KnexReadonlyTransaction
): Promise<ChartViewMetadata[]> => {
    type RawRow = Omit<ChartViewMetadata, "queryParamsForParentChart"> & {
        queryParamsForParentChart: JsonString
    }
    const rows: RawRow[] = await db.knexRaw(
        knex,
        `-- sql
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
    )

    return rows.map((row) => ({
        ...row,
        queryParamsForParentChart: JSON.parse(row.queryParamsForParentChart),
    }))
}
