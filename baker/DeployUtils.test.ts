/**
 * An admin edit deploys by requesting a Buildkite build once its transaction
 * commits (enqueueDeployChange + runAfterCommit in db.ts). These tests drive
 * the real transaction wrapper over a stand-in for knex, so they can commit,
 * roll back and nest without MySQL, read the build requests off a stubbed
 * fetch, and move time with fake timers.
 *
 * The contract:
 * - every change a committed outermost transaction enqueues goes out, in one
 *   request; a rollback sends nothing; a savepoint's changes wait for the
 *   outermost commit;
 * - the first edit after a quiet spell is requested right away, edits in the
 *   following window are held and go out together when it ends (an ETL push
 *   of hundreds of calls becomes a handful of requests), and nothing held is
 *   dropped, including on shutdown;
 * - a failed request never fails the edit, whose data is already committed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Knex } from "knex"
import {
    KnexReadWriteTransaction,
    knexReadWriteTransaction,
    TransactionCloseMode,
} from "../db/db.js"
import { DEPLOY_REQUEST_WINDOW_MS } from "@ourworldindata/utils"
import { enqueueDeployChange, flushHeldDeployChanges } from "./DeployUtils.js"

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

/** Commit one transaction that enqueues `message` */
const edit = (message: string): Promise<void> =>
    inTransaction(async (trx) => enqueueDeployChange(trx, author, message))

/** Let requests that were sent without waiting finish (setImmediate isn't faked) */
const settle = (): Promise<void> =>
    new Promise((resolve) => setImmediate(resolve))

/** Each request's changes, as the Slack note lists them */
const requestedChanges = (): string[][] =>
    buildRequests.map((request) =>
        request.env.CHANGES_SLACK_MENTIONS.split("\n").map((line) =>
            line.replace(" (by Ada Lovelace)", "")
        )
    )

interface BuildRequest {
    message: string
    branch: string
    env: Record<string, string>
}

let buildRequests: BuildRequest[]
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    buildRequests = []
    fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
        buildRequests.push(JSON.parse(init.body as string))
        return new Response(JSON.stringify({ number: 42 }), { status: 201 })
    })
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
})

afterEach(async () => {
    // Clear the window and anything held, so tests don't leak into each other
    await flushHeldDeployChanges()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe(enqueueDeployChange, () => {
    it("requests one build per committed transaction, carrying all its changes", async () => {
        await inTransaction(async (trx) => {
            enqueueDeployChange(trx, author, "Updating chart a")
            enqueueDeployChange(trx, author, "Updating chart b")
            await settle()
            // Nothing goes out before the commit
            expect(buildRequests).toEqual([])
        })
        await settle()

        expect(buildRequests).toHaveLength(1)
        const [request] = buildRequests
        expect(request.branch).toBe("test-branch")
        expect(request.message).toBe(
            "🚚 Updating chart a (by Ada Lovelace) and 1 more updates"
        )
        expect(requestedChanges()).toEqual([
            ["Updating chart a", "Updating chart b"],
        ])
        expect(request.env.CONTENT_DEPLOY).toBe("1")
    })

    it("requests nothing when the transaction rolls back", async () => {
        await expect(
            inTransaction(async (trx) => {
                enqueueDeployChange(trx, author, "Updating chart a")
                throw new Error("validation failed")
            })
        ).rejects.toThrow("validation failed")
        await vi.advanceTimersByTimeAsync(DEPLOY_REQUEST_WINDOW_MS)
        await settle()

        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("sends a savepoint's changes once the outermost transaction commits", async () => {
        await inTransaction(async (outer) => {
            await inTransaction(async (savepoint) => {
                enqueueDeployChange(savepoint, author, "Updating chart a")
            }, outer)
            await settle()
            // Released savepoint, outer transaction still open
            expect(buildRequests).toEqual([])
        })
        await settle()

        expect(requestedChanges()).toEqual([["Updating chart a"]])
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
        await settle()

        expect(console.error).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining("401"),
            })
        )
    })
})

describe("a burst of edits", () => {
    it("requests the first edit right away and the rest of its window together when the window ends", async () => {
        await edit("a")
        await settle()
        expect(requestedChanges()).toEqual([["a"]])

        await vi.advanceTimersByTimeAsync(DEPLOY_REQUEST_WINDOW_MS / 4)
        await edit("b")
        await vi.advanceTimersByTimeAsync(DEPLOY_REQUEST_WINDOW_MS / 4)
        await edit("c")
        await settle()
        // Held: a build requested for "a" may already be baking
        expect(requestedChanges()).toEqual([["a"]])

        await vi.advanceTimersByTimeAsync(DEPLOY_REQUEST_WINDOW_MS / 2) // a window after "a"
        await settle()
        expect(requestedChanges()).toEqual([["a"], ["b", "c"]])
    })

    it("keeps holding while edits keep coming, one request per window", async () => {
        await edit("a") // sent
        await vi.advanceTimersByTimeAsync(DEPLOY_REQUEST_WINDOW_MS / 2)
        await edit("b") // half a window later: held
        await vi.advanceTimersByTimeAsync(DEPLOY_REQUEST_WINDOW_MS / 2)
        // A window after "a": "b" goes out and opens the next window
        await edit("c") // held for that window
        await vi.advanceTimersByTimeAsync(DEPLOY_REQUEST_WINDOW_MS - 1)
        await settle()
        expect(requestedChanges()).toEqual([["a"], ["b"]])

        await vi.advanceTimersByTimeAsync(1) // two windows after "a"
        await settle()
        expect(requestedChanges()).toEqual([["a"], ["b"], ["c"]])
    })

    it("requests the next edit right away once a window passes with nothing held", async () => {
        await edit("a")
        await vi.advanceTimersByTimeAsync(DEPLOY_REQUEST_WINDOW_MS)
        await settle()
        expect(requestedChanges()).toEqual([["a"]])

        await edit("b")
        await settle()
        expect(requestedChanges()).toEqual([["a"], ["b"]])
    })

    it("sends held edits on shutdown", async () => {
        await edit("a")
        await edit("b")
        await settle()
        expect(requestedChanges()).toEqual([["a"]])

        await flushHeldDeployChanges()
        expect(requestedChanges()).toEqual([["a"], ["b"]])
    })

    it("waits on shutdown for a request still in flight", async () => {
        let respond = (): void => undefined
        fetchMock.mockImplementationOnce(
            () =>
                new Promise<Response>((resolve) => {
                    respond = () => resolve(new Response("{}"))
                })
        )
        await edit("a")
        await settle()

        let flushed = false
        const flushing = flushHeldDeployChanges().then(() => (flushed = true))
        await settle()
        expect(flushed).toBe(false)

        respond()
        await flushing
        expect(flushed).toBe(true)
    })
})
