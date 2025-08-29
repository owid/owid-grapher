export const SessionsTableName = "sessions"
export interface DbInsertSession {
    expire_date: Date
    user_id: number
    session_key: string
}
export type DbPlainSession = Required<DbInsertSession>
