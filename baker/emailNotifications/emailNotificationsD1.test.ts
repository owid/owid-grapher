import { describe, expect, it } from "vitest"
import {
    D1Client,
    D1QueryError,
    queryWithRetry,
} from "./emailNotificationsD1.js"

/** A client whose queries fail with the given errors, then succeed. */
function makeFlakyClient(errors: Error[]): D1Client & { attempts: number } {
    const client = {
        attempts: 0,
        query: async <T>(): Promise<T[]> => {
            const error = errors[client.attempts++]
            if (error) throw error
            return [{ ok: true }] as T[]
        },
    }
    return client
}

const options = { minTimeout: 1 }

describe(queryWithRetry, () => {
    it("retries transient failures until the query succeeds", async () => {
        const client = makeFlakyClient([
            new D1QueryError("Network connection lost", true),
            new D1QueryError("D1 query failed (429)", true),
        ])
        await expect(
            queryWithRetry(client, "INSERT ...", [], options)
        ).resolves.toEqual([{ ok: true }])
        expect(client.attempts).toBe(3)
    })

    it("throws non-retryable failures right away", async () => {
        const client = makeFlakyClient([
            new D1QueryError("UNIQUE constraint failed", false),
        ])
        await expect(
            queryWithRetry(client, "INSERT ...", [], options)
        ).rejects.toThrow("UNIQUE constraint failed")
        expect(client.attempts).toBe(1)
    })

    it("gives up after the maximum number of attempts", async () => {
        const client = makeFlakyClient(
            Array.from(
                { length: 5 },
                () => new D1QueryError("Network connection lost", true)
            )
        )
        await expect(
            queryWithRetry(client, "INSERT ...", [], options)
        ).rejects.toThrow("Network connection lost")
        expect(client.attempts).toBe(5)
    })
})
