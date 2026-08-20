import { expect, it, describe } from "vitest"

import { parseUserMentions } from "./Comments.js"

describe(parseUserMentions, () => {
    it("finds a handle anywhere in the comment", () => {
        expect(parseUserMentions("this looks off, @marcelgerber")).toEqual([
            "marcelgerber",
        ])
        expect(parseUserMentions("@edomt can you check this?")).toEqual([
            "edomt",
        ])
    })

    it("finds several, without duplicates", () => {
        expect(
            parseUserMentions("@edomt and @danyx23 - also @edomt again")
        ).toEqual(["edomt", "danyx23"])
    })

    it("lowercases, since handles are written however people remember them", () => {
        // The team has handles like CGiattino and eoo-owid
        expect(parseUserMentions("@CGiattino")).toEqual(["cgiattino"])
    })

    it("keeps dashes, which handles are allowed to contain", () => {
        expect(parseUserMentions("@eoo-owid should see this")).toEqual([
            "eoo-owid",
        ])
    })

    it("leaves the agent alone, which has its own path", () => {
        expect(parseUserMentions("@claude fix this")).toEqual([])
        expect(parseUserMentions("@claude and @edomt")).toEqual(["edomt"])
    })

    it("does not treat an email address as a mention", () => {
        expect(parseUserMentions("forwarded from someone@example.com")).toEqual(
            []
        )
    })

    it("finds nothing in an ordinary comment", () => {
        expect(parseUserMentions("the unit here looks wrong")).toEqual([])
        expect(parseUserMentions("")).toEqual([])
    })
})
