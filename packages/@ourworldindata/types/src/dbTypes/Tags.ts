/** the entity in the `tags` table */
export const TagsTableName = "tags"
export interface DbInsertTag {
    createdAt?: Date
    id?: number
    name: string
    slug?: string | null
    specialType?: string | null
    updatedAt?: Date | null
}

export type DbPlainTag = Required<DbInsertTag>

// For now, this is all the metadata we need for tags in the frontend
export type MinimalTag = Pick<DbPlainTag, "id" | "name" | "slug">

// Used in the tag graph
export type MinimalTagWithIsTopic = MinimalTag & {
    isTopic: boolean
}
