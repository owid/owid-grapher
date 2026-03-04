export const ChartsTableName = "charts"
export interface DbInsertChart {
    configId: string
    createdAt?: Date
    forceDatapage?: boolean
    id?: number
    isInheritanceEnabled?: boolean
    lastEditedAt: Date
    lastEditedByUserId: number
    publishedAt?: Date | null
    publishedByUserId?: number | null
    updatedAt?: Date | null
}
export type DbPlainChart = Required<DbInsertChart>
