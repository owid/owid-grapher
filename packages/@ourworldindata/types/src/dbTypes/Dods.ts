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

export const DodUsageTypes = [
    "explorer",
    "gdoc",
    "grapher",
    "indicator",
    "dod",
] as const

export type DodUsageType = (typeof DodUsageTypes)[number]

export type DodUsageRecord = {
    id: string
    title: string
    type: DodUsageType
}
