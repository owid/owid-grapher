/**
 * An admin edit deploys by requesting a Buildkite build (enqueueDeployChange).
 * These tests read the build requests off a stubbed fetch and move time with
 * fake timers.
 *
 * The contract:
 * - the first edit after a quiet spell is requested right away, edits in the
 *   following window are held and go out together when it ends (an ETL push
 *   of hundreds of calls becomes a handful of requests), and nothing held is
 *   dropped, including on shutdown;
 * - a failed request never fails the edit, and every failure lands in one
 *   Sentry issue.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEPLOY_REQUEST_WINDOW_MS } from "@ourworldindata/utils"
import { enqueueDeployChange, flushHeldDeployChanges } from "./DeployUtils.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"

vi.mock(import("../settings/serverSettings.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    BAKE_ON_CHANGE: true,
    BUILDKITE_API_ACCESS_TOKEN: "test-token",
    BUILDKITE_DEPLOY_CONTENT_PIPELINE_SLUG: "test-pipeline",
    BUILDKITE_BRANCH: "test-branch",
}))

vi.mock(import("../serverUtils/errorLog.js"), () => ({
    logErrorAndMaybeCaptureInSentry: vi.fn(async () => undefined),
}))

const author = { fullName: "Ada Lovelace", email: "ada@example.com" }

const edit = (message: string): void => enqueueDeployChange(author, message)

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
    it("requests a build for the first edit right away", async () => {
        edit("Updating chart a")
        await settle()

        expect(buildRequests).toHaveLength(1)
        const [request] = buildRequests
        expect(request.branch).toBe("test-branch")
        expect(request.message).toBe("🚚 Updating chart a (by Ada Lovelace)")
        expect(request.env.CONTENT_DEPLOY).toBe("1")
    })

    it("doesn't throw when the build request fails, and reports every failure as one Sentry issue", async () => {
        fetchMock.mockResolvedValueOnce(
            new Response("Bad credentials", { status: 401 })
        )

        expect(() => edit("Updating chart a")).not.toThrow()
        await settle()

        expect(logErrorAndMaybeCaptureInSentry).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining("401"),
            }),
            expect.objectContaining({
                fingerprint: ["deploy-request-failed"],
            })
        )
    })
})

describe("a burst of edits", () => {
    it("requests the first edit right away and the rest of its window together when the window ends", async () => {
        edit("a")
        await settle()
        expect(requestedChanges()).toEqual([["a"]])

        await vi.advanceTimersByTimeAsync(DEPLOY_REQUEST_WINDOW_MS / 4)
        edit("b")
        await vi.advanceTimersByTimeAsync(DEPLOY_REQUEST_WINDOW_MS / 4)
        edit("c")
        await settle()
        // Held: a build requested for "a" may already be baking
        expect(requestedChanges()).toEqual([["a"]])

        await vi.advanceTimersByTimeAsync(DEPLOY_REQUEST_WINDOW_MS / 2) // a window after "a"
        await settle()
        expect(requestedChanges()).toEqual([["a"], ["b", "c"]])
        expect(buildRequests[1].message).toBe(
            "🚚 b (by Ada Lovelace) and 1 more updates"
        )
    })

    it("keeps holding while edits keep coming, one request per window", async () => {
        edit("a") // sent
        await vi.advanceTimersByTimeAsync(DEPLOY_REQUEST_WINDOW_MS / 2)
        edit("b") // half a window later: held
        await vi.advanceTimersByTimeAsync(DEPLOY_REQUEST_WINDOW_MS / 2)
        // A window after "a": "b" goes out and opens the next window
        edit("c") // held for that window
        await vi.advanceTimersByTimeAsync(DEPLOY_REQUEST_WINDOW_MS - 1)
        await settle()
        expect(requestedChanges()).toEqual([["a"], ["b"]])

        await vi.advanceTimersByTimeAsync(1) // two windows after "a"
        await settle()
        expect(requestedChanges()).toEqual([["a"], ["b"], ["c"]])
    })

    it("requests the next edit right away once a window passes with nothing held", async () => {
        edit("a")
        await vi.advanceTimersByTimeAsync(DEPLOY_REQUEST_WINDOW_MS)
        await settle()
        expect(requestedChanges()).toEqual([["a"]])

        edit("b")
        await settle()
        expect(requestedChanges()).toEqual([["a"], ["b"]])
    })

    it("sends held edits on shutdown", async () => {
        edit("a")
        edit("b")
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
        edit("a")
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
