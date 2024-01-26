export const PostsGdocsXTagsTableName = "posts_gdocs_x_tags"
export interface PostsGdocsXTagsRowForInsert {
    gdocId: string
    tagId: number
}
export type PostsGdocsXTagsRow = Required<PostsGdocsXTagsRowForInsert>
