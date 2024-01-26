export const UsersTableName = "users"
export interface UsersRowForInsert {
    createdAt?: Date
    email: string
    fullName: string
    id?: number
    isActive?: number
    isSuperuser?: number
    lastLogin?: Date | null
    lastSeen?: Date | null
    password?: string | null
    updatedAt?: Date | null
}
export type UsersRow = Required<UsersRowForInsert>
