export const SessionsTableName = "sessions"
export interface DbInsertSession {
    expire_date: Date
    session_data: string
    session_key: string
}
export type DbPlainSession = Required<DbInsertSession>
