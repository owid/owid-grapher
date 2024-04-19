export enum RedirectCode {
    MOVED_PERMANENTLY = 301,
    FOUND = 302,
}

export interface DbInsertRedirect {
    id: number
    source: string
    target: string
    code: RedirectCode
    createdAt?: Date | null
    updatedAt?: Date | null
}

export type DbPlainRedirect = Required<DbInsertRedirect>
