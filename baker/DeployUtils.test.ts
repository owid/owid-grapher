/**
 * An admin edit deploys by requesting one Buildkite build once its
 * transaction commits (enqueueDeployChange + runAfterCommit in db.ts). These
 * tests drive the real transaction wrapper over a stand-in for knex, so they
 * can commit, roll back and nest without MySQL, and read the build requests
 * off a stubbed fetch.
 *
 * The contract: every change a committed outermost transaction enqueues goes
 * out in exactly one request; a rollback sends nothing; a savepoint's changes
 * wait for the outermost commit; and a failed request never fails the edit,
 * whose data is already committed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Knex } from "knex"
import {
    KnexReadWriteTransaction,
    knexReadWriteTransaction,
    TransactionCloseMode,
} from "../db/db.js"
import { enqueueDeployChange } from "./DeployUtils.js"

vi.mock(import("../settings/serverSettings.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    BAKE_ON_CHANGE: true,
    BUILDKITE_API_ACCESS_TOKEN: "test-token",
    BUILDKITE_DEPLOY_CONTENT_PIPELINE_SLUG: "test-pipeline",
    BUILDKITE_BRANCH: "test-branch",
}))

const author = { fullName: "Ada Lovelace", email: "ada@example.com" }

/** Stands in for knex: runs the callback, rejecting when it throws, like a rollback */
function fakeKnex(isTransaction = false): Knex {
    return {
        isTransaction,
        transaction: async (fn: (trx: Knex.Transaction) => Promise<unknown>) =>
            fn(fakeKnex(true) as Knex.Transaction),
    } as unknown as Knex
}

const inTransaction = <T>(
    fn: (trx: KnexReadWriteTransaction) => Promise<T>,
    knex: Knex = fakeKnex()
): Promise<T> =>
    knexReadWriteTransaction(fn, TransactionCloseMode.KeepOpen, knex)

interface BuildRequest {
    message: string
    branch: string
    env: Record<string, string>
}

let buildRequests: BuildRequest[]
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
    buildRequests = []
    fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
        buildRequests.push(JSON.parse(init.body as string))
        return new Response(JSON.stringify({ number: 42 }), { status: 201 })
    })
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe(enqueueDeployChange, () => {
    it("requests one build per committed transaction, carrying all its changes", async () => {
        await inTransaction(async (trx) => {
            enqueueDeployChange(trx, author, "Updating chart a")
            enqueueDeployChange(trx, author, "Updating chart b")
            // Nothing goes out before the commit
            expect(buildRequests).toEqual([])
        })

        expect(buildRequests).toHaveLength(1)
        const [request] = buildRequests
        expect(request.branch).toBe("test-branch")
        expect(request.message).toBe(
            "🚚 Updating chart a (by Ada Lovelace) and 1 more updates"
        )
        expect(request.env.CHANGES_SLACK_MENTIONS).toBe(
            "Updating chart a (by Ada Lovelace)\nUpdating chart b (by Ada Lovelace)"
        )
        expect(request.env.CONTENT_DEPLOY).toBe("1")
        expect(request.env.DEPLOY_REQUESTED_AT).toMatch(/^\d+$/)
    })

    it("requests nothing when the transaction rolls back", async () => {
        await expect(
            inTransaction(async (trx) => {
                enqueueDeployChange(trx, author, "Updating chart a")
                throw new Error("validation failed")
            })
        ).rejects.toThrow("validation failed")

        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("sends a savepoint's changes once the outermost transaction commits", async () => {
        await inTransaction(async (outer) => {
            await inTransaction(async (savepoint) => {
                enqueueDeployChange(savepoint, author, "Updating chart a")
            }, outer)
            // Released savepoint, outer transaction still open
            expect(buildRequests).toEqual([])
        })

        expect(buildRequests).toHaveLength(1)
    })

    it("doesn't fail the edit when the build request fails", async () => {
        fetchMock.mockResolvedValueOnce(
            new Response("Bad credentials", { status: 401 })
        )

        await expect(
            inTransaction(async (trx) => {
                enqueueDeployChange(trx, author, "Updating chart a")
                return "saved"
            })
        ).resolves.toBe("saved")
        expect(console.error).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining("401"),
            })
        )
    })
})
