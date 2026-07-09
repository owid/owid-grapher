import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import { CommentsTableName, CommentTargetType } from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"

const env = getAdminTestEnv()

describe("Comments API", { timeout: 15000 }, () => {
    const testChartConfig = {
        $schema: latestGrapherConfigSchema,
        slug: "test-chart",
        title: "Test chart",
        chartTypes: ["LineChart"],
    }

    let chartId: number

    beforeEach(async () => {
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        chartId = response.chartId
    })

    async function requestExpectingError(arg: {
        method: "POST" | "PUT" | "DELETE"
        path: string
        body?: string
        expectedStatus: number
    }): Promise<void> {
        const response = await fetch(env.baseUrl + arg.path, {
            method: arg.method,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${env.apiKey}`,
            },
            body: arg.body,
        })
        expect(response.status).toBe(arg.expectedStatus)
    }

    function createComment(body: Record<string, unknown>): Promise<any> {
        return env.request({
            method: "POST",
            path: "/comments",
            body: JSON.stringify(body),
        })
    }

    function listComments(query = ""): Promise<any> {
        return env.fetchJson(
            `/comments.json?targetType=chart&targetId=${chartId}${query}`
        )
    }

    it("creates and lists comments with author information", async () => {
        const { id } = await createComment({
            targetType: CommentTargetType.Chart,
            targetId: chartId,
            content: "The subtitle has a typo",
            anchor: "subtitle",
        })
        expect(typeof id).toBe("number")

        const { comments, currentUserId } = await listComments()
        expect(comments).toHaveLength(1)
        expect(comments[0]).toMatchObject({
            id,
            targetType: CommentTargetType.Chart,
            targetId: chartId,
            anchor: "subtitle",
            viewState: null,
            parentId: null,
            content: "The subtitle has a typo",
            authorFullName: "Admin",
            resolvedAt: null,
        })
        expect(comments[0].userId).toBe(currentUserId)
    })

    it("rejects comments on targets that don't exist", async () => {
        await requestExpectingError({
            method: "POST",
            path: "/comments",
            body: JSON.stringify({
                targetType: CommentTargetType.Chart,
                targetId: 9999,
                content: "Comment on a missing chart",
            }),
            expectedStatus: 404,
        })
        await requestExpectingError({
            method: "POST",
            path: "/comments",
            body: JSON.stringify({
                targetType: CommentTargetType.Variable,
                targetId: chartId,
                content: "Chart ids are not variable ids",
            }),
            expectedStatus: 404,
        })
    })

    it("stores the multi-dim view state of a comment", async () => {
        const viewState = { metric: "cases", frequency: "weekly" }
        await createComment({
            targetType: CommentTargetType.Chart,
            targetId: chartId,
            content: "This view looks off",
            viewState,
        })
        const { comments } = await listComments()
        expect(comments[0].viewState).toEqual(viewState)
    })

    it("supports one level of threaded replies", async () => {
        const { id: rootId } = await createComment({
            targetType: CommentTargetType.Chart,
            targetId: chartId,
            content: "Root comment",
        })
        const { id: replyId } = await createComment({
            parentId: rootId,
            content: "A reply",
        })

        const { comments } = await listComments()
        expect(comments).toHaveLength(2)
        const reply = comments.find((c: any) => c.id === replyId)
        // The reply inherits the target from the root comment
        expect(reply).toMatchObject({
            parentId: rootId,
            targetType: CommentTargetType.Chart,
            targetId: chartId,
            content: "A reply",
        })

        // Replying to a reply is not allowed
        await requestExpectingError({
            method: "POST",
            path: "/comments",
            body: JSON.stringify({
                parentId: replyId,
                content: "A nested reply",
            }),
            expectedStatus: 400,
        })
    })

    it("resolves and reopens threads", async () => {
        const { id: rootId } = await createComment({
            targetType: CommentTargetType.Chart,
            targetId: chartId,
            content: "Root comment",
        })
        const { id: replyId } = await createComment({
            parentId: rootId,
            content: "A reply",
        })

        await env.request({
            method: "PUT",
            path: `/comments/${rootId}/resolved`,
            body: JSON.stringify({ resolved: true }),
        })

        // Resolved threads (including their replies) are hidden by default...
        const { comments: unresolvedOnly } = await listComments()
        expect(unresolvedOnly).toHaveLength(0)

        // ...but included on request, with resolution metadata
        const { comments: all } = await listComments("&includeResolved=true")
        expect(all).toHaveLength(2)
        const root = all.find((c: any) => c.id === rootId)
        expect(root.resolvedAt).not.toBeNull()
        expect(root.resolvedByFullName).toBe("Admin")

        await env.request({
            method: "PUT",
            path: `/comments/${rootId}/resolved`,
            body: JSON.stringify({ resolved: false }),
        })
        const { comments: reopened } = await listComments()
        expect(reopened).toHaveLength(2)

        // Replies themselves cannot be resolved
        await requestExpectingError({
            method: "PUT",
            path: `/comments/${replyId}/resolved`,
            body: JSON.stringify({ resolved: true }),
            expectedStatus: 400,
        })
    })

    it("deletes a thread along with its replies", async () => {
        const { id: rootId } = await createComment({
            targetType: CommentTargetType.Chart,
            targetId: chartId,
            content: "Root comment",
        })
        await createComment({ parentId: rootId, content: "A reply" })
        expect(await env.getCount(CommentsTableName)).toBe(2)

        await env.request({
            method: "DELETE",
            path: `/comments/${rootId}`,
        })
        expect(await env.getCount(CommentsTableName)).toBe(0)
    })
})
