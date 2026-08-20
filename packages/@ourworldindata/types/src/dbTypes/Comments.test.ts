import { expect, it, describe } from "vitest"

import { invokesAgent } from "./Comments.js"

describe(invokesAgent, () => {
    it("fires when the comment opens with the mention", () => {
        expect(invokesAgent("@claude fix this typo")).toBe(true)
    })

    // The reason the rule is loose: a sentence is how people actually write, and
    // a mention that silently does nothing is the one failure nobody can debug.
    it("fires when the mention sits mid-sentence", () => {
        expect(invokesAgent("can @claude fix this typo?")).toBe(true)
        expect(
            invokesAgent("this looks wrong, @claude please take a look")
        ).toBe(true)
        expect(invokesAgent("I think @claude should handle this one")).toBe(
            true
        )
    })

    it("fires at the end of a sentence", () => {
        expect(invokesAgent("the unit is wrong here, over to @claude")).toBe(
            true
        )
    })

    it("is case-insensitive, since people type it however they like", () => {
        expect(invokesAgent("@Claude fix this")).toBe(true)
        expect(invokesAgent("ask @CLAUDE about it")).toBe(true)
    })

    it("does not fire on a longer word that merely starts with the mention", () => {
        expect(invokesAgent("@claudette should look at this")).toBe(false)
        expect(invokesAgent("@claude-bot is something else")).toBe(false)
    })

    it("does not fire on an email address", () => {
        expect(invokesAgent("forwarded from someone@claude.example.com")).toBe(
            false
        )
    })

    it("does not fire on an ordinary comment", () => {
        expect(invokesAgent("the unit here looks wrong")).toBe(false)
        expect(invokesAgent("claude without the at sign")).toBe(false)
        expect(invokesAgent("")).toBe(false)
    })
})
