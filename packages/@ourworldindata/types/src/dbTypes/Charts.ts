export const ChartsTableName = "charts"
export interface DbInsertChart {
    configId: string
    configIdETL?: string | null
    catalogPath?: string | null
    createdAt?: Date
    forceDatapage?: boolean
    id?: number
    isInheritanceEnabled?: boolean
    lastEditedAt: Date
    lastEditedByUserId: number
    publishedAt?: Date | null
    publishedByUserId?: number | null
    updatedAt?: Date
}
export type DbPlainChart = Required<DbInsertChart>
