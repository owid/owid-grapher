export const TagsVariablesTopicTagsRowTableName = "tags_variables_topic_tags"
export interface TagsVariablesTopicTagsRowForInsert {
    displayOrder?: number
    tagId: number
    variableId: number
}
export type TagsVariablesTopicTagsRow =
    Required<TagsVariablesTopicTagsRowForInsert>
