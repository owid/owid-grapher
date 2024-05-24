/** the entity in the `tags` table */
export const TagsTableName = "tags"
export interface DbInsertTag {
    createdAt?: Date
    id?: number
    name: string
    parentId?: number | null
    slug?: string | null
    specialType?: string | null
    updatedAt?: Date | null
    isArea?: boolean
}
export type DbPlainTag = Required<DbInsertTag>

// For now, this is all the metadata we need for tags in the frontend
export type MinimalTag = Pick<DbPlainTag, "id" | "name" | "slug">
