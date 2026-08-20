import { expect, it, describe } from "vitest"

import { CommentTargetType } from "@ourworldindata/types"
import { CommentAgentContext } from "./commentAgentProcessor.js"
import { buildEtlPrompt, parseCliResult } from "./commentAgentEtl.js"

function context(
    overrides: Partial<CommentAgentContext> = {}
): CommentAgentContext {
    return {
        commentId: 2,
        rootCommentId: 1,
        instruction: "@claude the unit looks wrong",
        thread: [
            {
                author: "Pablo Rosado",
                content: "@claude the unit looks wrong",
                isAgent: false,
                isInvocation: true,
            },
        ],
        targetType: CommentTargetType.MultiDim,
        targetId: 2713,
        targetKey: "education/latest/enrolment_rates#enrolment_rates",
        anchor: "subtitle",
        viewState: { level: "preprimary", sex: "both" },
        ...overrides,
    }
}

describe(buildEtlPrompt, () => {
    it("says which indicator, view and field, since the checkout can't know", () => {
        const prompt = buildEtlPrompt(context())

        expect(prompt).toContain(
            "education/latest/enrolment_rates#enrolment_rates"
        )
        expect(prompt).toContain("level = preprimary")
        expect(prompt).toContain("Field commented on: subtitle")
    })

    it("marks which comment is the one asking", () => {
        const prompt = buildEtlPrompt(
            context({
                thread: [
                    {
                        author: "Pablo Rosado",
                        content: "this looks odd",
                        isAgent: false,
                        isInvocation: false,
                    },
                    {
                        author: "Marcel Gerber",
                        content: "@claude have a look",
                        isAgent: false,
                        isInvocation: true,
                    },
                ],
            })
        )

        expect(prompt).toContain("Marcel Gerber [the comment asking you]")
        expect(prompt).not.toContain("Pablo Rosado [the comment asking you]")
    })

    it("attributes the agent's own earlier replies to it", () => {
        const prompt = buildEtlPrompt(
            context({
                thread: [
                    {
                        author: "Claude",
                        content: "It reads as a share.",
                        isAgent: true,
                        isInvocation: false,
                    },
                ],
            })
        )

        expect(prompt).toContain("You (Claude): It reads as a share.")
    })
})

describe(parseCliResult, () => {
    it("takes the result out of the CLI's json", () => {
        expect(
            parseCliResult(
                JSON.stringify({
                    type: "result",
                    subtype: "success",
                    result: "The unit is percent, not count.\n",
                })
            )
        ).toBe("The unit is percent, not count.")
    })

    it("raises what the CLI reported rather than posting it as an answer", () => {
        expect(() =>
            parseCliResult(
                JSON.stringify({
                    is_error: true,
                    subtype: "error_max_turns",
                    result: "ran out of turns",
                })
            )
        ).toThrow(/error_max_turns/)
    })

    // Better an oddly formatted reply than none: the json shape is the CLI's,
    // and a version that changes it shouldn't silence the agent.
    it("falls back to raw output when it isn't json", () => {
        expect(parseCliResult("The unit is percent.\n")).toBe(
            "The unit is percent."
        )
    })

    it("refuses an empty result", () => {
        expect(() => parseCliResult(JSON.stringify({ result: "  " }))).toThrow(
            /empty/
        )
    })
})
