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

    it("allows superusers to act as another user via x-act-as-user", async () => {
        const superuser = await env
            .testKnex(UsersTableName)
            .where({ isSuperuser: 1 })
            .first<DbPlainUser>()
        expect(superuser).toBeTruthy()

        const [actAsUserId] = await env.testKnex(UsersTableName).insert({
            email: "act-as-user@example.com",
            fullName: "Act As User",
            isActive: 1,
            isSuperuser: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSeen: null,
        })

        await env
            .testKnex(UsersTableName)
            .where({ id: superuser!.id })
            .update({ lastSeen: null })

        const { apiKey } = await seedApiKeyForUser(superuser!.id)

        const response = await fetch(`${env.baseUrl}/users.json`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "x-act-as-user": String(actAsUserId),
            },
        })

        expect(response.status).toBe(200)

        const updatedActAsUser = await env
            .testKnex(UsersTableName)
            .where({ id: actAsUserId as number })
            .first<DbPlainUser>()

        const updatedSuperuser = await env
            .testKnex(UsersTableName)
            .where({ id: superuser!.id })
            .first<DbPlainUser>()

        expect(updatedActAsUser?.lastSeen).toBeTruthy()
        expect(updatedSuperuser?.lastSeen).toBeNull()
    })

    it("rejects x-act-as-user for non-superusers", async () => {
        const [primaryUserId] = await env.testKnex(UsersTableName).insert({
            email: "non-superuser@example.com",
            fullName: "Non Superuser",
            isActive: 1,
            isSuperuser: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSeen: null,
        })

        const [actAsUserId] = await env.testKnex(UsersTableName).insert({
            email: "ignored-act-as@example.com",
            fullName: "Ignored Act As",
            isActive: 1,
            isSuperuser: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSeen: null,
        })

        const { apiKey, id } = await seedApiKeyForUser(primaryUserId as number)

        const response = await fetch(`${env.baseUrl}/users.json`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "x-act-as-user": String(actAsUserId),
            },
        })

        expect(response.status).toBe(401)

        const apiKeyRow = await env
            .testKnex(AdminApiKeysTableName)
            .where({ id })
            .first()

        const updatedPrimaryUser = await env
            .testKnex(UsersTableName)
            .where({ id: primaryUserId as number })
            .first<DbPlainUser>()

        const updatedActAsUser = await env
            .testKnex(UsersTableName)
            .where({ id: actAsUserId as number })
            .first<DbPlainUser>()

        expect(apiKeyRow?.lastUsedAt).toBeNull()
        expect(updatedPrimaryUser?.lastSeen).toBeNull()
        expect(updatedActAsUser?.lastSeen).toBeNull()
    })
})
