export const PostTagsRowTableName = "post_tags"
export interface PostTagsRowForInsert {
    createdAt?: Date
    post_id: number
    tag_id: number
    updatedAt?: Date | null
}
export type PostTagsRow = Required<PostTagsRowForInsert>
