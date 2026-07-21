export const RedirectsTableName = "redirects"

export interface DbInsertRedirect {
    id: number
    source: string
    target: string
    createdAt?: Date
    updatedAt?: Date
    ttl?: Date | null
}

export type DbPlainRedirect = Required<DbInsertRedirect>
