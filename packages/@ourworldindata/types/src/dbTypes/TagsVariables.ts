export const TagsVariablesTopicTagsTableName = "tags_variables_topic_tags"
export interface DbInsertTagVariableTopicTag {
    displayOrder?: number
    tagId: number
    variableId: number
}
export type DbPlainTagVariableTopicTag = Required<DbInsertTagVariableTopicTag>
