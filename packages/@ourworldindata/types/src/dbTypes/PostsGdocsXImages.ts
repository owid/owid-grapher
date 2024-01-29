export const PostsGdocsXImagesTableName = "posts_gdocs_x_images"
export interface DbInsertPostGdocXImage {
    gdocId: string
    id?: number
    imageId: number
}
export type DbPlainPostGdocXImage = Required<DbInsertPostGdocXImage>
