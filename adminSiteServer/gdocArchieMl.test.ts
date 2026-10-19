import { describe, expect, it } from "vitest"
import { JsonError, type OwidGdocBaseInterface } from "@ourworldindata/types"
import type { KnexReadonlyTransaction } from "../db/db.js"
import {
    compareReadBack,
    findUnwritableCharacter,
    getNewGdocName,
    isShareableEmail,
    loadWritableGdoc,
} from "./gdocArchieMl.js"

describe(isShareableEmail, () => {
    it("accepts an address with a local part and a domain", () => {
        expect(isShareableEmail("dev@ourworldindata.org")).toBe(true)
    })

    it.each([undefined, "", "dev", "@ourworldindata.org", "dev@", "a b@c.d"])(
        "refuses %j",
        (value) => {
            expect(isShareableEmail(value)).toBe(false)
        }
    )

    it("refuses a repeated query parameter, which Express parses as an array", () => {
        expect(isShareableEmail(["a@b.c", "d@e.f"])).toBe(false)
    })
})

describe(getNewGdocName, () => {
    it("uses the front-matter title", () => {
        expect(getNewGdocName("  Life expectancy ")).toBe("Life expectancy")
    })

    it.each([undefined, "", "   "])(
        "falls back to Untitled for %j",
        (title) => {
            expect(getNewGdocName(title)).toBe("Untitled")
        }
    )
})

describe(findUnwritableCharacter, () => {
    it("allows tab, newline and the vertical tab (Google's soft line break)", () => {
        expect(
            findUnwritableCharacter("title: a\tb\nsoft\u000Bbreak\n")
        ).toBeUndefined()
    })

    it.each([0x0000, 0x0008, 0x000c, 0x000d, 0x001f, 0xe000, 0xf8ff])(
        "refuses code point %i, naming its line",
        (codePoint) => {
            const character = String.fromCodePoint(codePoint)
            const text = `title: ok\nbody ${character} here\n`
            expect(findUnwritableCharacter(text)).toEqual({
                line: 2,
                codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`,
            })
        }
    )

    it("allows the characters just outside the refused ranges", () => {
        const text = String.fromCodePoint(0x0020, 0x007f, 0xdfff, 0xf900)
        expect(findUnwritableCharacter(text)).toBeUndefined()
    })

    it("names the first offending line", () => {
        expect(findUnwritableCharacter("a\nb\r\nc\u0001\n")).toEqual({
            line: 2,
            codePoint: "U+000D",
        })
    })
})

describe(loadWritableGdoc, () => {
    // loadWritableGdoc loads no state, so it never queries the DB
    const noDb = {} as KnexReadonlyTransaction
    // A registered article; the text decides the type that gets loaded
    const base = {
        id: "gdoc-archieml-unit-test",
        slug: "draft",
        content: { type: "article", title: "Draft" },
        published: false,
        tags: null,
    } as unknown as OwidGdocBaseInterface

    it("loads the text's type, which may differ from the stored one", async () => {
        const gdoc = await loadWritableGdoc(
            noDb,
            base,
            "type: data-insight\ntitle: Hello\n"
        )
        expect(gdoc.content.type).toBe("data-insight")
        expect(gdoc.content.title).toBe("Hello")
    })

    it.each([
        ["an unknown type", "type: not-a-type\ntitle: Hello\n", /not-a-type/],
        ["a missing type", "title: Hello\n", /missing/],
    ])("refuses %s with a 400", async (_label, text, message) => {
        const thrown = await loadWritableGdoc(noDb, base, text).catch(
            (error: unknown) => error
        )
        expect(thrown).toBeInstanceOf(JsonError)
        expect((thrown as JsonError).status).toBe(400)
        expect((thrown as JsonError).message).toMatch(message)
    })
})

describe(compareReadBack, () => {
    it("matches identical text", () => {
        expect(compareReadBack("a\nb\n", "a\nb\n")).toEqual({ match: true })
    })

    it("reports the first differing line", () => {
        expect(compareReadBack("a\nb\nc\n", "a\nB\nC\n")).toEqual({
            match: false,
            line: 2,
            sent: "b",
            stored: "B",
        })
    })

    it("counts whitespace differences", () => {
        expect(compareReadBack("a \n", "a\n")).toMatchObject({
            match: false,
            line: 1,
        })
    })

    it("reports a missing trailing newline as a difference", () => {
        // Google always stores a final newline
        expect(compareReadBack("a\nb", "a\nb\n")).toEqual({
            match: false,
            line: 3,
            sent: undefined,
            stored: "",
        })
    })
})
