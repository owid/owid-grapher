import { expect, it, describe } from "vitest"

import { CommentTargetType } from "@ourworldindata/types"
import {
    CommentAgentContext,
    CommentAgentThreadEntry,
} from "./commentAgentProcessor.js"
import { threadToMessages } from "./commentAgentClaude.js"

function contextWith(thread: CommentAgentThreadEntry[]): CommentAgentContext {
    return {
        commentId: 1,
        rootCommentId: 1,
        instruction: "@claude look at this",
        thread,
        targetType: CommentTargetType.Chart,
        targetId: 1,
        targetKey: null,
        anchor: "subtitle",
        viewState: null,
    }
}

function person(author: string, content: string): CommentAgentThreadEntry {
    return { author, content, isAgent: false, isInvocation: false }
}

function agent(content: string): CommentAgentThreadEntry {
    return { author: "Claude", content, isAgent: true, isInvocation: false }
}

/**
 * The Messages API requires turns to alternate, and a comment thread has no such
 * rule - two colleagues can write in a row, and the agent can be mentioned in a
 * reply to its own reply. Both shapes occur in normal use, so both are asserted.
 */
describe(threadToMessages, () => {
    it("makes the agent's own replies its turns", () => {
        const messages = threadToMessages(
            contextWith([
                person("Pablo Rosado", "@claude the unit looks wrong"),
                agent("It reads as a share, not a count."),
                person("Pablo Rosado", "@claude yes, fix that"),
            ])
        )

        expect(messages.map((m) => m.role)).toEqual([
            "user",
            "assistant",
            "user",
        ])
        expect(messages[1].content).toBe("It reads as a share, not a count.")
    })

    it("names the author, so the agent knows who it is talking to", () => {
        const messages = threadToMessages(
            contextWith([person("Pablo Rosado", "@claude have a look")])
        )

        expect(messages[0].content).toBe("Pablo Rosado: @claude have a look")
    })

    it("merges consecutive comments from people into one turn", () => {
        const messages = threadToMessages(
            contextWith([
                person("Pablo Rosado", "the unit looks wrong"),
                person("Marcel Gerber", "@claude agreed, it's a share"),
            ])
        )

        expect(messages).toHaveLength(1)
        expect(messages[0].role).toBe("user")
        expect(messages[0].content).toBe(
            "Pablo Rosado: the unit looks wrong\n\n" +
                "Marcel Gerber: @claude agreed, it's a share"
        )
    })

    it("does not open with an assistant turn", () => {
        // Happens when only the agent's own reply and later comments are in
        // scope; the API rejects a conversation that starts with the assistant.
        const messages = threadToMessages(
            contextWith([
                agent("It reads as a share."),
                person("Pablo Rosado", "@claude fix it then"),
            ])
        )

        expect(messages[0].role).toBe("user")
        expect(messages.at(-1)?.content).toBe(
            "Pablo Rosado: @claude fix it then"
        )
    })
})
