export const DatasetFilesTableName = "dataset_files"
export interface DbInsertDatasetFile {
    createdAt?: Date
    datasetId: number
    file: any
    filename: string
    updatedAt?: Date | null
}
export type DbPlainDatasetFile = Required<DbInsertDatasetFile>
