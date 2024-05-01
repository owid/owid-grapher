export const ChartsXEntitiesTableName = "charts_x_entities"

export interface DbInsertChartXEntity {
    chartId: number
    entityId: number
}

export type DbPlainChartXEntity = Required<DbInsertChartXEntity>
