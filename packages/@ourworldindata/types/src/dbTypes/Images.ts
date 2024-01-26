export const ImagesTableName = "images"
export interface DbInsertImage {
    defaultAlt: string
    filename: string
    googleId: string
    id?: number
    originalWidth?: number | null
    updatedAt?: string | null
}
export type DbPlainImage = Required<DbInsertImage>
