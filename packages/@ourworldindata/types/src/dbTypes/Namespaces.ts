export const NamespacesTableName = "namespaces"
export interface DbInsertNamespace {
    createdAt?: Date
    description?: string | null
    id?: number
    isArchived?: number
    name: string
    updatedAt?: Date
}
export type DbPlainNamespace = Required<DbInsertNamespace>
