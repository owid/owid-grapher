/** the entity in the `post_tags` table */
export interface PostTag {
    post_id: number
    tag_id: number
    createdAt: Date
    updatedAt: Date | null
}
