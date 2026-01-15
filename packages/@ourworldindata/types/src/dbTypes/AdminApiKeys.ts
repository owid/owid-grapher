export const AdminApiKeysTableName = "admin_api_keys"

export interface DbAdminApiKey {
    id: number
    userId: number
    keyHash: string
    createdAt: Date
    lastUsedAt: Date | null
}
