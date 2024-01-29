export const DatasetTagsTableName = "dataset_tags"
export interface DbInsertDatasetTag {
    createdAt?: Date
    datasetId: number
    tagId: number
    updatedAt?: Date | null
}
export type DbPlainDatasetTag = Required<DbInsertDatasetTag>
