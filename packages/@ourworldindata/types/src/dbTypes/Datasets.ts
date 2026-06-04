import { JsonString } from "../domainTypes/Various.js"

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
    // JSON array of OWID team-member display names who maintain this dataset;
    // the first entry is the accountable owner. Populated from ETL via
    // DatasetMeta.owners. Stored as a JSON string; parse before use.
    owners?: JsonString | null
    shortName?: string | null
    sourceChecksum?: string | null
    updatedAt?: Date
    updatePeriodDays?: number | null
    version?: string | null
}
export type DbPlainDataset = Required<DbInsertDataset>
