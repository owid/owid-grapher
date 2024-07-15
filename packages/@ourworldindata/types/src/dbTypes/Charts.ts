export const ChartsTableName = "charts"
export interface DbInsertChart {
    configId: Buffer
    createdAt?: Date
    id?: number
    isIndexable?: number
    lastEditedAt: Date
    lastEditedByUserId: number
    publishedAt?: Date | null
    publishedByUserId?: number | null
    updatedAt?: Date | null
}
export type DbPlainChart = Required<DbInsertChart>
