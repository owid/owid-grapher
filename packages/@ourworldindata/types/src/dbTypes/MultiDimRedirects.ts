export const MultiDimRedirectsTableName = "multi_dim_redirects"

export interface DbInsertMultiDimRedirect {
    id?: number
    source: string
    multiDimId: number
    viewConfigId?: string | null
    createdAt?: Date
    updatedAt?: Date
}

export interface DbPlainMultiDimRedirect {
    id: number
    source: string
    multiDimId: number
    viewConfigId: string | null
    createdAt: Date
    updatedAt: Date
}
