import { DbPlainUser } from "./Users.js"

export const FilesTableName = "files"
export interface DbInsertFile {
    id?: number
    filename: string
    path: string
    etag: string
    createdAt?: Date
    createdBy?: DbPlainUser["id"] | null
}
export type DbPlainFile = Required<DbInsertFile>
