export const PostTagsTableName = "post_tags"
export interface DbInsertPostTag {
    createdAt?: Date
    post_id: number
    tag_id: number
    updatedAt?: Date | null
}
export type DbPlainPostTag = Required<DbInsertPostTag>
