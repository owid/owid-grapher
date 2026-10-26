import { describe, expect, it, vi } from "vitest"
import type { docs_v1 } from "@googleapis/docs"
import { JsonError, type OwidGdocBaseInterface } from "@ourworldindata/types"
import type { KnexReadonlyTransaction } from "../db/db.js"
import {
    compareReadBack,
    fetchGdocArchieMl,
    findUnwritableCharacter,
    getNewGdocName,
    isShareableEmail,
    loadWritableGdoc,
    requireRevisionId,
} from "./gdocArchieMl.js"

// The document Google returns to fetchGdocArchieMl
const googleDocument = vi.hoisted(() => ({
    current: {} as docs_v1.Schema$Document,
}))
vi.mock(import("@googleapis/docs"), async (importOriginal) => {
    const originalModule = await importOriginal()
    const docs = (() => ({
        documents: {
            get: async () => ({ data: googleDocument.current }),
        },
    })) as unknown as typeof originalModule.docs
    return { ...originalModule, docs }
})

// A doc whose body is the single paragraph `line`
function documentWithLine(
    line: string,
    revisionId?: string
): docs_v1.Schema$Document {
    return {
        revisionId,
        body: {
            content: [
                {
                    paragraph: {
                        elements: [{ textRun: { content: `${line}\n` } }],
                    },
                },
            ],
        },
    }
}

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

describe(fetchGdocArchieMl, () => {
    it("returns the text and revision id of a doc the service account can edit", async () => {
        googleDocument.current = documentWithLine("title: Hello", "rev-1")

        expect(await fetchGdocArchieMl("editable-doc")).toEqual({
            text: expect.stringContaining("title: Hello"),
            revisionId: "rev-1",
        })
    })

    it("returns a null revision id for a doc it can only view", async () => {
        // Google leaves out revisionId without edit access
        googleDocument.current = documentWithLine("title: Hello")

        expect(await fetchGdocArchieMl("view-only-doc")).toEqual({
            text: expect.stringContaining("title: Hello"),
            revisionId: null,
        })
    })
})

describe(requireRevisionId, () => {
    it("passes a revision id through", () => {
        expect(requireRevisionId("rev-1", "doc")).toBe("rev-1")
    })

    it.each([null, undefined, ""])(
        "refuses %j with a 500 naming the doc",
        (revisionId) => {
            const thrown = (() => {
                try {
                    return requireRevisionId(revisionId, "view-only-doc")
                } catch (error) {
                    return error
                }
            })()
            expect(thrown).toBeInstanceOf(JsonError)
            expect((thrown as JsonError).status).toBe(500)
            expect((thrown as JsonError).message).toMatch(/view-only-doc/)
        }
    )
})
