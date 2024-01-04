export const DatasetTagsRowTableName = "dataset_tags"
export interface DatasetTagsRowForInsert {
    createdAt?: Date
    datasetId: number
    tagId: number
    updatedAt?: Date | null
}
export type DatasetTagsRow = Required<DatasetTagsRowForInsert>
