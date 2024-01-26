export const NamespacesTableName = "namespaces"
export interface DbInsertNamespace {
    createdAt?: Date
    description?: string | null
    id?: number
    isArchived?: number
    name: string
    updatedAt?: Date | null
}
export type DbPlainNamespace = Required<DbInsertNamespace>
