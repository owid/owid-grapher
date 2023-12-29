/** the entity in the `tags` table */
export interface Tag {
    id: number
    name: string
    createdAt: Date
    updatedAt: Date
    parentId: number
    isBulkImport: boolean
    specialType: string
    slug: string | null
}
