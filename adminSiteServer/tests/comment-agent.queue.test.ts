import { describe, it, expect, beforeEach } from "vitest"

import { JobsTableName } from "@ourworldindata/types"
import { knexReadWriteTransaction } from "../../db/db.js"
import { enqueueCommentAgentJob } from "../../db/model/Jobs.js"
import { getAdminTestEnv } from "./testEnv.js"

const env = getAdminTestEnv()

/**
 * The queue is what stops a worker that polls for work from acting on the same
 * invocation twice, so the guarantees live here rather than in the worker.
 */
describe("comment agent job queue", { timeout: 15000 }, () => {
    beforeEach(async () => {
        await env.testKnex(JobsTableName).delete()
    })

    it("queues one job for a comment", async () => {
        const queued = await knexReadWriteTransaction((trx) =>
            enqueueCommentAgentJob(trx, { commentId: 1 })
        )
        expect(queued).toBe(true)

        const jobs = await env.testKnex(JobsTableName).select("*")
        expect(jobs).toHaveLength(1)
        expect(jobs[0].type).toBe("comment_agent_request")
        expect(jobs[0].state).toBe("queued")
    })

    it("refuses a second job for the same comment", async () => {
        await knexReadWriteTransaction((trx) =>
            enqueueCommentAgentJob(trx, { commentId: 1 })
        )
        const again = await knexReadWriteTransaction((trx) =>
            enqueueCommentAgentJob(trx, { commentId: 1 })
        )
        expect(again).toBe(false)
        expect(await env.testKnex(JobsTableName).select("*")).toHaveLength(1)
    })

    // The one that matters for a polling worker: a finished invocation must not
    // come back. Guarding on the row existing, not on its state, is what does it.
    it("does not re-queue a comment whose job already ran", async () => {
        await knexReadWriteTransaction((trx) =>
            enqueueCommentAgentJob(trx, { commentId: 1 })
        )
        await env.testKnex(JobsTableName).update({ state: "done" })

        const again = await knexReadWriteTransaction((trx) =>
            enqueueCommentAgentJob(trx, { commentId: 1 })
        )
        expect(again).toBe(false)
        expect(await env.testKnex(JobsTableName).select("*")).toHaveLength(1)
    })

    it("does not re-queue a comment whose job gave up", async () => {
        await knexReadWriteTransaction((trx) =>
            enqueueCommentAgentJob(trx, { commentId: 1 })
        )
        await env.testKnex(JobsTableName).update({ state: "failed" })

        const again = await knexReadWriteTransaction((trx) =>
            enqueueCommentAgentJob(trx, { commentId: 1 })
        )
        expect(again).toBe(false)
    })

    it("keeps different comments apart", async () => {
        await knexReadWriteTransaction((trx) =>
            enqueueCommentAgentJob(trx, { commentId: 1 })
        )
        const other = await knexReadWriteTransaction((trx) =>
            enqueueCommentAgentJob(trx, { commentId: 2 })
        )
        expect(other).toBe(true)
        expect(await env.testKnex(JobsTableName).select("*")).toHaveLength(2)
    })
})
