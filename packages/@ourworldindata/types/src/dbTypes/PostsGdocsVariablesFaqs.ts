export const PostsGdocsVariablesFaqsTableName = "posts_gdocs_variables_faqs"
export interface PostsGdocsVariablesFaqsRowForInsert {
    displayOrder?: number
    fragmentId: string
    gdocId: string
    variableId: number
}
export type PostsGdocsVariablesFaqsRow =
    Required<PostsGdocsVariablesFaqsRowForInsert>
