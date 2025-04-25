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

export type DodUsageRecord = {
    id: string
    title: string
    type: "explorer" | "gdoc" | "grapher" | "indicator" | "dod"
}
