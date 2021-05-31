import { CoreColumn } from "../../coreTable/CoreTableColumns"
import { SeriesStrategy } from "../core/GrapherConstants"
import { LineChartSeries } from "./LineChartConstants"

export const columnToLineChartSeriesArray = (
    col: CoreColumn,
    seriesStrategy: SeriesStrategy,
    canSelectMultipleEntities: boolean
): LineChartSeries[] => {
    const { isProjection, owidRowsByEntityName } = col
    const entityNames = Array.from(owidRowsByEntityName.keys())
    return entityNames.map((entityName) => {
        let seriesName
        if (seriesStrategy === SeriesStrategy.entity) {
            if (col.isProjection && col.displayName) {
                seriesName = `${entityName} - ${col.displayName}`
            } else {
                seriesName = entityName
            }
        } else {
            if (canSelectMultipleEntities) {
                seriesName = `${entityName} - ${col.displayName}`
            } else {
                seriesName = col.displayName
            }
        }
        return {
            points: owidRowsByEntityName.get(entityName)!.map((row) => {
                return {
                    x: row.time,
                    y: row.value,
                }
            }),
            seriesName,
            isProjection,
            color: "#000", // tmp
        }
    })
}
