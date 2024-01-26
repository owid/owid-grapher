/** the entity in the `tags` table */
export const TagsTableName = "tags"
export interface TagsRowForInsert {
    createdAt?: Date
    id?: number
    isBulkImport?: number
    name: string
    parentId?: number | null
    slug?: string | null
    specialType?: string | null
    updatedAt?: Date | null
}
export type TagsRow = Required<TagsRowForInsert>
