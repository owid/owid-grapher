export const SessionsRowTableName = "sessions"
export interface SessionsRowForInsert {
    expire_date: Date
    session_data: string
    session_key: string
}
export type SessionsRow = Required<SessionsRowForInsert>
