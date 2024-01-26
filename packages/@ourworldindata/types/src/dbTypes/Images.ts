export const ImagesTableName = "images"
export interface ImagesRowForInsert {
    defaultAlt: string
    filename: string
    googleId: string
    id?: number
    originalWidth?: number | null
    updatedAt?: string | null
}
export type ImagesRow = Required<ImagesRowForInsert>
