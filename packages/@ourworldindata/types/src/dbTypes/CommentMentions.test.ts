import { expect, it, describe } from "vitest"

import { findMentionedCandidates } from "./Comments.js"

// A slice of the real team, including the two shared first names and the
// handle shapes that actually occur
const team = [
    { fullName: "Pablo Rosado", handle: "pabloarosado" },
    { fullName: "Pablo Arriagada", handle: "paarriagadap" },
    { fullName: "Charlie Giattino", handle: "CGiattino" },
    { fullName: "Esteban Ortiz-Ospina", handle: "eoo-owid" },
    { fullName: "Marcel Gerber", handle: null },
]
const names = (content: string): string[] =>
    findMentionedCandidates(content, team).map((c) => c.fullName)

describe(findMentionedCandidates, () => {
    it("matches a full name, which is what the picker inserts", () => {
        expect(names("@Pablo Rosado can you look at this?")).toEqual([
            "Pablo Rosado",
        ])
    })

    it("keeps the two Pablos apart", () => {
        expect(names("@Pablo Rosado")).toEqual(["Pablo Rosado"])
        expect(names("@Pablo Arriagada")).toEqual(["Pablo Arriagada"])
    })

    it("still matches a handle, for anyone typing from memory", () => {
        expect(names("@pabloarosado take a look")).toEqual(["Pablo Rosado"])
        expect(names("@eoo-owid")).toEqual(["Esteban Ortiz-Ospina"])
    })

    it("is case-insensitive both ways", () => {
        expect(names("@pablo rosado")).toEqual(["Pablo Rosado"])
        expect(names("@cgiattino")).toEqual(["Charlie Giattino"])
    })

    it("matches mid-sentence and at the end", () => {
        expect(names("this looks off, over to @Marcel Gerber")).toEqual([
            "Marcel Gerber",
        ])
    })

    it("finds several people", () => {
        expect(names("@Marcel Gerber and @cgiattino")).toEqual([
            "Charlie Giattino",
            "Marcel Gerber",
        ])
    })

    it("works for someone with no handle recorded", () => {
        expect(names("@Marcel Gerber")).toEqual(["Marcel Gerber"])
    })

    it("does not match a name running into another word", () => {
        expect(names("@Pablo Rosadoism is not a thing")).toEqual([])
    })

    it("does not treat an email address as a mention", () => {
        expect(names("forwarded from someone@example.com")).toEqual([])
    })

    it("finds nobody in an ordinary comment", () => {
        expect(names("the unit here looks wrong")).toEqual([])
        expect(names("")).toEqual([])
    })
})
