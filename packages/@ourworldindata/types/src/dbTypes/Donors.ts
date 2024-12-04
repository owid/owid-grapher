export const DonorsTableName = "donors"

export type DbInsertDonor = {
    name: string
    originalName: string
    shouldPublish: boolean
    comment: string
    createdAt?: Date
    updatedAt?: Date
}

export type DbPlainDonor = Required<DbInsertDonor> & {
    id: number
}
