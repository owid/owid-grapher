export const ChartsTableName = "charts"
export interface DbInsertChart {
    configId: string
    createdAt?: Date
    id?: number
    isIndexable?: boolean
    isInheritanceEnabled?: boolean
    lastEditedAt: Date
    lastEditedByUserId: number
    publishedAt?: Date | null
    publishedByUserId?: number | null
    updatedAt?: Date | null
}
export type DbPlainChart = Required<DbInsertChart>
