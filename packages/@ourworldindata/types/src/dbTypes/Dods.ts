export const DodsTableName = "dods"

export interface DbInsertDod {
    name: string
    content: string
    lastUpdatedUserId: number
    createdAt?: Date
    updatedAt?: Date
    id?: number
}

export type DbPlainDod = Required<DbInsertDod>
