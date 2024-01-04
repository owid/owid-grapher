export const PostsGdocsXImagesRowTableName = "posts_gdocs_x_images"
export interface PostsGdocsXImagesRowForInsert {
    gdocId: string
    id?: number
    imageId: number
}
export type PostsGdocsXImagesRow = Required<PostsGdocsXImagesRowForInsert>
