export const DatasetsTableName = "datasets"
export interface DbInsertDataset {
    createdAt?: Date
    createdByUserId: number
    dataEditedAt: Date
    dataEditedByUserId: number
    description: string
    id?: number
    isArchived?: number
    isPrivate?: number
    metadataEditedAt: Date
    metadataEditedByUserId: number
    name: string
    namespace: string
    nonRedistributable?: number
    shortName?: string | null
    sourceChecksum?: string | null
    updatedAt?: Date | null
    updatePeriodDays?: number | null
    version?: string | null
}
export type DbPlainDataset = Required<DbInsertDataset>
