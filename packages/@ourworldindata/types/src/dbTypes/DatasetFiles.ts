export const DatasetFilesTableName = "dataset_files"
export interface DatasetFilesRowForInsert {
    createdAt?: Date
    datasetId: number
    file: any
    filename: string
    updatedAt?: Date | null
}
export type DatasetFilesRow = Required<DatasetFilesRowForInsert>
