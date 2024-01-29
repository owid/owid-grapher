export const PostsGdocsVariablesFaqsTableName = "posts_gdocs_variables_faqs"
export interface DbInsertPostGdocVariableFaq {
    displayOrder?: number
    fragmentId: string
    gdocId: string
    variableId: number
}
export type DbPlainPostGdocVariableFaq = Required<DbInsertPostGdocVariableFaq>
