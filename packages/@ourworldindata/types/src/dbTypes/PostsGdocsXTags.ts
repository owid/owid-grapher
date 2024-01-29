export const PostsGdocsXTagsTableName = "posts_gdocs_x_tags"
export interface DbInsertPostGdocXTag {
    gdocId: string
    tagId: number
}
export type DbPlainPostGdocXTag = Required<DbInsertPostGdocXTag>
