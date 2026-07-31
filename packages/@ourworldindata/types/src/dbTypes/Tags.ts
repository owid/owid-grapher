/** the entity in the `tags` table */
export const TagsTableName = "tags"
export interface DbInsertTag {
    createdAt?: Date
    id?: number
    name: string
    searchableInAlgolia?: boolean
    slug?: string | null
    specialType?: string | null
    updatedAt?: Date
}

export type DbPlainTag = Required<DbInsertTag>

// For now, this is all the metadata we need for tags in the frontend
export type MinimalTag = Pick<DbPlainTag, "id" | "name" | "slug">

export type TagGraphRole = "area" | "descendant" | "orphan"

// Used in the tag graph
export type MinimalTagWithMetadata = MinimalTag & {
    tagGraphRole: TagGraphRole
    isTopic: boolean
    isSearchable: boolean
}
