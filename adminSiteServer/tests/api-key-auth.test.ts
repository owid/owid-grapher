import { describe, it, expect } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    AdminApiKeysTableName,
    UsersTableName,
    type DbPlainUser,
} from "@ourworldindata/types"
import { createApiKey, hashApiKey } from "../../serverUtils/apiKey.js"

const env = getAdminTestEnv()

async function seedApiKeyForUser(userId: number) {
    const apiKey = createApiKey()
    const keyHash = hashApiKey(apiKey)
    const [id] = await env
        .testKnex(AdminApiKeysTableName)
        .insert({ userId, keyHash })
    return { apiKey, id: id as number }
}

describe("Admin API key auth", { timeout: 10000 }, () => {
    it("updates lastUsedAt when a valid API key is provided", async () => {
        const user = await env.testKnex(UsersTableName).first<DbPlainUser>()
        expect(user).toBeTruthy()

        const { apiKey, id } = await seedApiKeyForUser(user!.id)

        const response = await fetch(`${env.baseUrl}/users.json`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        })

        expect(response.status).toBe(200)

        const apiKeyRow = await env
            .testKnex(AdminApiKeysTableName)
            .where({ id })
            .first()

        expect(apiKeyRow?.lastUsedAt).toBeTruthy()
    })

    it("fails to authenticate when API key is missing", async () => {
        const user = await env.testKnex(UsersTableName).first<DbPlainUser>()
        expect(user).toBeTruthy()

        const { id } = await seedApiKeyForUser(user!.id)

        const response = await fetch(`${env.baseUrl}/users.json`)
        expect(response.status).toBe(401)

        const apiKeyRow = await env
            .testKnex(AdminApiKeysTableName)
            .where({ id })
            .first()

        expect(apiKeyRow?.lastUsedAt).toBeNull()
    })
})
