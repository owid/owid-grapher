import { describe, expect, it } from "vitest"

import { archieToEnriched } from "@ourworldindata/gdoc-pipeline"
import { compareArchieMlContent, validateArchieMl } from "./validateArchieMl.js"
import {
    joinArchieMlSkipSegments,
    splitArchieMlSkipSegments,
} from "./archieMlSkipBlocks.js"

describe(validateArchieMl, () => {
    const doc = (body: string, frontmatter: string = "type: article"): string =>
        `title: Test doc
authors: Author
${frontmatter}
[+body]
${body}
[]
`

    it("accepts a valid document", () => {
        const result = validateArchieMl(doc("Hello world"))
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
        expect(result.content?.body).toHaveLength(1)
    })

    it("reports an unknown block type as a parse failure", () => {
        const result = validateArchieMl(doc("{.small-chart}\nurl: test\n{}"))
        expect(result.valid).toBe(false)
        expect(result.content).toBeUndefined()
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].message).toContain("failed to parse")
    })

    it("reports attribute-level parseErrors on known blocks", () => {
        const result = validateArchieMl(doc("{.chart}\ncaption: hi\n{}"))
        expect(result.valid).toBe(false)
        expect(result.errors).toEqual([
            expect.objectContaining({
                property: "body",
                message: expect.stringContaining("url property is missing"),
            }),
        ])
        // The parse itself succeeded, so the content is still returned
        expect(result.content).toBeDefined()
    })

    it("requires a writable gdoc type by default", () => {
        const missing = validateArchieMl(doc("Hello", ""))
        expect(missing.valid).toBe(false)
        expect(missing.errors).toEqual([
            expect.objectContaining({ property: "type" }),
        ])

        const wrong = validateArchieMl(doc("Hello", "type: homepage"))
        expect(wrong.valid).toBe(false)
        expect(wrong.errors[0].message).toContain('"homepage"')

        const dataInsight = validateArchieMl(doc("Hello", "type: data-insight"))
        expect(dataInsight.valid).toBe(true)

        const off = validateArchieMl(doc("Hello", ""), { requireType: false })
        expect(off.valid).toBe(true)
    })

    it("round-trips inline and id-based refs", () => {
        const result = validateArchieMl(
            doc(
                "Hello{ref}An inline footnote.{/ref} and{ref}my-id{/ref} again{ref}my-id{/ref}.",
                "type: article\n[.refs]\nid: my-id\n[.+content]\nA shared footnote.\n[]\n[]"
            )
        )
        expect(result.errors).toEqual([])
        expect(result.valid).toBe(true)
        expect(
            Object.keys(result.content?.refs?.definitions ?? {})
        ).toHaveLength(2)
    })

    it("tolerates empty text blocks dropped by canonicalization", () => {
        // An inline tag left open across a paragraph break (as produced by
        // some real gdocs) yields a text block with zero spans. The write-back
        // emits nothing for it, so the re-parse legitimately drops it — the
        // fixed-point check must not flag that as content loss.
        const result = validateArchieMl(
            doc("Some <i>italic text\n\n</i>\n\nNext paragraph")
        )
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
    })

    it("passes documents with warnings but reports them", () => {
        const result = validateArchieMl(
            doc('Some <a href="https://owid.cloud/foo">link</a>')
        )
        expect(result.valid).toBe(true)
        expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("rejects unrecognized front-matter keys (e.g. a misspelled field)", () => {
        // A typo of a real field would otherwise be silently dropped on
        // write, losing the intended value — so an unknown key is an error.
        const result = validateArchieMl(
            doc("Hello", "type: article\nsutitle: Oops a typo")
        )
        expect(result.valid).toBe(false)
        expect(result.errors).toContainEqual(
            expect.objectContaining({
                property: "sutitle",
                message: expect.stringContaining("Unrecognized"),
            })
        )
    })

    it("points admin-managed keys like slug to the admin settings", () => {
        const result = validateArchieMl(
            doc("Hello", "type: article\nslug: my-slug")
        )
        expect(result.valid).toBe(true)
        expect(result.warnings).toContainEqual(
            expect.objectContaining({
                property: "slug",
                message: expect.stringContaining("admin"),
            })
        )
    })

    it("refuses front matter the write-back cannot serialize yet", () => {
        const result = validateArchieMl(
            doc(
                "Hello",
                "type: article\n[.faqs]\nid: what-is-this\n[.+content]\nAn answer.\n[]\n[]"
            )
        )
        expect(result.valid).toBe(false)
        expect(result.errors).toContainEqual(
            expect.objectContaining({
                property: "faqs",
                message: expect.stringContaining("not yet supported"),
            })
        )
    })

    it("rejects the legacy byline key (new drafts must use authors)", () => {
        // `byline` is a pre-2023 alias the parse still honours (so authorship
        // is understood), but it is not a field new drafts should use — the
        // write-back emits `authors`, so the stray `byline` key is rejected as
        // unrecognized. The fix is to rename it to `authors`.
        const result = validateArchieMl(`title: Test doc
byline: Jane Doe (Editor)
type: article
[+body]
Hello world.
[]
`)
        expect(result.valid).toBe(false)
        expect(result.errors).toContainEqual(
            expect.objectContaining({
                property: "byline",
                message: expect.stringContaining("Unrecognized"),
            })
        )
        // the parse still understood the authorship, it's just the wrong key
        expect(result.content?.authorRoles).toEqual({ "Jane Doe": "Editor" })
    })
})

describe(splitArchieMlSkipSegments, () => {
    const skipBlock = ":skip\nSome hidden preview link\n:endskip"

    it("passes through documents without directives", () => {
        const text = "title: t\n[+body]\nHello\n[]\n"
        const s = splitArchieMlSkipSegments(text)
        expect(s.prefix).toBe("")
        expect(s.core).toBe(text)
        expect(s.suffix).toBe("")
        expect(s.midDocumentDirectiveLines).toEqual([])
    })

    it("captures a leading skip block as prefix", () => {
        const text = `${skipBlock}\n\ntitle: t\n[+body]\nHello\n[]\n`
        const s = splitArchieMlSkipSegments(text)
        expect(s.prefix).toBe(skipBlock)
        expect(s.core.startsWith("\ntitle: t")).toBe(true)
        expect(s.midDocumentDirectiveLines).toEqual([])
        expect(joinArchieMlSkipSegments(s, "CANON")).toBe(`${skipBlock}\nCANON`)
    })

    it("captures a trailing skip block and an :ignore tail as suffix", () => {
        const text = `title: t\n[+body]\nHello\n[]\n\n${skipBlock}\n:ignore\ngraveyard text`
        const s = splitArchieMlSkipSegments(text)
        expect(s.prefix).toBe("")
        expect(s.core).toContain("Hello")
        expect(s.core).not.toContain(":skip")
        expect(s.suffix).toContain(":skip")
        expect(s.suffix).toContain(":ignore\ngraveyard text")
        expect(s.midDocumentDirectiveLines).toEqual([])
    })

    it("treats an unterminated :skip as a suffix (it runs to EOF)", () => {
        const text = `title: t\n[+body]\nHello\n[]\n:skip\ndraft stuff`
        const s = splitArchieMlSkipSegments(text)
        expect(s.core).not.toContain(":skip")
        expect(s.suffix).toBe(":skip\ndraft stuff")
        expect(s.midDocumentDirectiveLines).toEqual([])
    })

    it("flags mid-document skip blocks with their line numbers", () => {
        const text = `title: t\n[+body]\nBefore\n${skipBlock}\nAfter\n[]\n`
        const s = splitArchieMlSkipSegments(text)
        expect(s.midDocumentDirectiveLines).toEqual([4, 6])
        expect(s.prefix).toBe("")
        expect(s.suffix).toBe("")
    })
})

describe(compareArchieMlContent, () => {
    const parse = (body: string): ReturnType<typeof archieToEnriched> =>
        archieToEnriched(`title: t\ntype: article\n[+body]\n${body}\n[]\n`)

    it("reports identical for equivalent content", () => {
        const result = compareArchieMlContent(
            parse("Hello <b>world</b>"),
            parse("Hello <b>world</b>")
        )
        expect(result.identical).toBe(true)
    })

    it("pinpoints differing blocks", () => {
        const result = compareArchieMlContent(
            parse("Same\n\nDiffers here\n\nSame again"),
            parse("Same\n\nDiffers HERE\n\nSame again")
        )
        expect(result.identical).toBe(false)
        expect(result.differingBodyBlocks).toEqual([1])
        expect(result.refsMatch).toBe(true)
    })
})
