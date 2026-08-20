import { expect, it, describe } from "vitest"

import { parseAgentInvocation } from "./Comments.js"

describe(parseAgentInvocation, () => {
    it("returns the instruction when the comment opens with the mention", () => {
        expect(parseAgentInvocation("@claude fix this typo")).toBe(
            "fix this typo"
        )
    })

    it("is case-insensitive, since people type it however they like", () => {
        expect(parseAgentInvocation("@Claude fix this typo")).toBe(
            "fix this typo"
        )
        expect(parseAgentInvocation("@CLAUDE fix this typo")).toBe(
            "fix this typo"
        )
    })

    it("allows leading whitespace and punctuation after the mention", () => {
        expect(parseAgentInvocation("  @claude: fix this")).toBe("fix this")
        expect(parseAgentInvocation("@claude, fix this")).toBe("fix this")
    })

    it("accepts a bare mention with no instruction", () => {
        expect(parseAgentInvocation("@claude")).toBe("")
    })

    // The important half. A comment box that opens pull requests on a substring
    // match would fire on people talking about the agent rather than to it.
    it("does not fire when the agent is merely being discussed", () => {
        expect(parseAgentInvocation("I think @claude got this wrong")).toBe(
            null
        )
        expect(
            parseAgentInvocation("we should ask @claude about this field")
        ).toBe(null)
        expect(parseAgentInvocation("this predates @claude")).toBe(null)
    })

    it("does not fire on a longer word that merely starts with the mention", () => {
        expect(parseAgentInvocation("@claudette should look at this")).toBe(
            null
        )
    })

    it("does not fire on an ordinary comment", () => {
        expect(parseAgentInvocation("the unit here looks wrong")).toBe(null)
        expect(parseAgentInvocation("")).toBe(null)
    })
})
