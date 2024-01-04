export const NamespacesRowTableName = "namespaces"
export interface NamespacesRowForInsert {
    createdAt?: Date
    description?: string | null
    id?: number
    isArchived?: number
    name: string
    updatedAt?: Date | null
}
export type NamespacesRow = Required<NamespacesRowForInsert>
