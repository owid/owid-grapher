import { expect, it, describe } from "vitest"

import { mentionCandidates } from "./mentionCandidates.js"

const USERS = [
    { fullName: "Claudia Example" },
    { fullName: "Pablo Rosado" },
    { fullName: "Pablo Arriagada" },
]

describe(mentionCandidates, () => {
    // The mention that does something was the one you had to know to type: the
    // agent's account is inactive, so it never appeared in the list of people.
    it("offers the agent", () => {
        expect(mentionCandidates(USERS, "cla").map((c) => c.fullName)).toEqual([
            "claude",
            "Claudia Example",
        ])
    })

    it("puts the agent first, since a mention of it is a request", () => {
        expect(mentionCandidates(USERS, "").at(0)?.fullName).toBe("claude")
    })

    it("leaves the agent out when the query doesn't match it", () => {
        expect(
            mentionCandidates(USERS, "pablo").map((c) => c.fullName)
        ).toEqual(["Pablo Rosado", "Pablo Arriagada"])
    })

    it("keeps both people who share a first name", () => {
        expect(mentionCandidates(USERS, "Pablo")).toHaveLength(2)
    })
})
