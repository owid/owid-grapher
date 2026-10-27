export const UsersTableName = "users"
export interface DbInsertUser {
    createdAt?: Date
    email: string
    fullName: string
    id?: number
    isActive?: boolean
    isSuperuser?: boolean
    lastLogin?: Date | null
    lastSeen?: Date | null
    updatedAt?: Date
    githubUsername?: string | null
    slackId?: string | null
    dataInsightFolderId?: string | null
}
export type DbPlainUser = Required<DbInsertUser>
