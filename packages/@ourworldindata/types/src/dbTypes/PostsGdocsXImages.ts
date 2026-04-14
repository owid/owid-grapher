export const PostsGdocsXImagesTableName = "posts_gdocs_x_images"

export type ImageContext = "content" | "article-thumbnail"

export interface DbInsertPostGdocXImage {
    gdocId: string
    id?: number
    imageId: number
    context: ImageContext
}
export type DbPlainPostGdocXImage = Required<DbInsertPostGdocXImage>
