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
        const seriesName =
            seriesStrategy === SeriesStrategy.entity
                ? entityName
                : canSelectMultipleEntities
                ? `${entityName} - ${col.displayName}`
                : col.displayName
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
