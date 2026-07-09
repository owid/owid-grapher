import { expect, it } from "vitest"

import { load } from "archieml"

import { extractRefs, stripIgnoredArchieml } from "./archieToEnriched.js"

// extractRefs annotates the post-extraction <a class="ref"> tag with
// data-ref-kind (and data-ref-id for ID-based refs) so that htmlToEnriched
// can preserve the source-form distinction into SpanRef.sourceForm.
const idRef = (note: number, id: string): string =>
    `<a class="ref" href="#note-${note}" data-ref-kind="id" data-ref-id="${id}"><sup>${note}</sup></a>`
const inlineRef = (note: number): string =>
    `<a class="ref" href="#note-${note}" data-ref-kind="inline"><sup>${note}</sup></a>`

it("Can extract a ref from some text", () => {
    expect(
        extractRefs(`I am a thing{ref}some_id{/ref} and some follow up`)
    ).toEqual({
        extractedText: `I am a thing${idRef(1, "some_id")} and some follow up`,
        refsByFirstAppearance: new Set(["some_id"]),
        rawInlineRefs: [],
    })
})

it("Can extract multiple refs from some text", () => {
    expect(
        extractRefs(
            `I am a thing{ref}some_id{/ref} and some follow up{ref}another_id{/ref}`
        )
    ).toEqual({
        extractedText: `I am a thing${idRef(1, "some_id")} and some follow up${idRef(2, "another_id")}`,
        refsByFirstAppearance: new Set(["some_id", "another_id"]),
        rawInlineRefs: [],
    })
})

it("Can extract multiple refs from some text and refer to an earlier footnote when a ref id is repeated", () => {
    expect(
        extractRefs(
            `I am a thing{ref}some_id{/ref} and some follow up{ref}another_id{/ref}. I refer to a ref that has already been referenced once{ref}some_id{/ref}`
        )
    ).toEqual({
        extractedText: `I am a thing${idRef(1, "some_id")} and some follow up${idRef(2, "another_id")}. I refer to a ref that has already been referenced once${idRef(1, "some_id")}`,
        refsByFirstAppearance: new Set(["some_id", "another_id"]),
        rawInlineRefs: [],
    })
})

it("Can extract an inline ref", () => {
    expect(extractRefs(`I am a thing{ref}I am an inline ref{/ref}`)).toEqual({
        extractedText: `I am a thing${inlineRef(1)}`,
        refsByFirstAppearance: new Set([
            "796885412908186a5e57f2e753ab697b85666afe",
        ]),
        rawInlineRefs: [
            {
                content: [
                    {
                        type: "text",
                        value: "I am an inline ref",
                    },
                ],
                id: "796885412908186a5e57f2e753ab697b85666afe",
            },
        ],
    })
})

it("Can extract an inline ref and an ID ref", () => {
    expect(
        extractRefs(
            `I am a thing{ref}I am an inline ref{/ref} and another thing{ref}some_id{/ref}`
        )
    ).toEqual({
        extractedText: `I am a thing${inlineRef(1)} and another thing${idRef(2, "some_id")}`,
        refsByFirstAppearance: new Set([
            "796885412908186a5e57f2e753ab697b85666afe",
            "some_id",
        ]),
        rawInlineRefs: [
            {
                content: [
                    {
                        type: "text",
                        value: "I am an inline ref",
                    },
                ],
                id: "796885412908186a5e57f2e753ab697b85666afe",
            },
        ],
    })
})

it("Can extract an inline ref and an ID ref and then refer back to a previous inline ref with identical content", () => {
    expect(
        extractRefs(
            `I am a thing{ref}I am an inline ref{/ref} and another thing{ref}some_id{/ref} and me again{ref}I am an inline ref{/ref}`
        )
    ).toEqual({
        extractedText: `I am a thing${inlineRef(1)} and another thing${idRef(2, "some_id")} and me again${inlineRef(1)}`,
        refsByFirstAppearance: new Set([
            "796885412908186a5e57f2e753ab697b85666afe",
            "some_id",
        ]),
        rawInlineRefs: [
            {
                content: [
                    {
                        type: "text",
                        value: "I am an inline ref",
                    },
                ],
                id: "796885412908186a5e57f2e753ab697b85666afe",
            },
        ],
    })
})

it("Drops everything after a :ignore line", () => {
    expect(
        stripIgnoredArchieml(
            `live text\n:ignore\nignored text{ref}ignored_id{/ref}`
        )
    ).toEqual(`live text\n`)
})

it("Honours :ignore even inside a :skip block", () => {
    expect(
        stripIgnoredArchieml(
            `live text\n:skip\nskipped{ref}skipped_id{/ref}\n:ignore\nignored{ref}ignored_id{/ref}`
        )
    ).toEqual(`live text\n:skip\n`)
})

it("Empties :skip / :endskip blocks but keeps the directive lines and surrounding text", () => {
    expect(
        stripIgnoredArchieml(
            `before\n:skip\nskipped{ref}skipped_id{/ref}\n:endskip\nafter`
        )
    ).toEqual(`before\n:skip\n:endskip\nafter`)
})

it("Empties an unterminated :skip block but keeps the :skip directive", () => {
    expect(
        stripIgnoredArchieml(`before\n:skip\nskipped{ref}skipped_id{/ref}`)
    ).toEqual(`before\n:skip\n`)
})

it("Preserves ArchieML buffer-flush semantics around a :skip block", () => {
    // ArchieML discards the buffered multi-line continuation at :skip, so `dek`
    // is just "first". Our pre-strip must keep the directive lines so load()
    // still does this — deleting the block would splice "draft" onto the value.
    const input = `dek: first\ndraft continuation\n:skip\nskipped\n:endskip\n:end`
    expect(load(input).dek).toEqual("first")
    expect(load(stripIgnoredArchieml(input)).dek).toEqual("first")
})

it("Ignores refs that appear after :ignore so footnote numbering is unaffected", () => {
    const text = `real{ref}some_id{/ref}\n:ignore\nfake{ref}another_id{/ref}`
    expect(extractRefs(stripIgnoredArchieml(text))).toEqual({
        extractedText: `real${idRef(1, "some_id")}\n`,
        refsByFirstAppearance: new Set(["some_id"]),
        rawInlineRefs: [],
    })
})

it("Can index intermingled inline and ID refs correctly", () => {
    expect(
        extractRefs(
            `I am a thing{ref}some_id{/ref} and another thing{ref}An inline ref{/ref} with more {ref}another_id{/ref} and even more{ref}Another inline ref{/ref}`
        )
    ).toEqual({
        extractedText: `I am a thing${idRef(1, "some_id")} and another thing${inlineRef(2)} with more ${idRef(3, "another_id")} and even more${inlineRef(4)}`,
        refsByFirstAppearance: new Set([
            "some_id",
            "3d708842b0da8d18eabe4d2212ba27646ed20f49",
            "another_id",
            "f5c4fee26da4a46180cef44bc019ec072ec66f3f",
        ]),
        rawInlineRefs: [
            {
                content: [
                    {
                        type: "text",
                        value: "An inline ref",
                    },
                ],
                id: "3d708842b0da8d18eabe4d2212ba27646ed20f49",
            },
            {
                content: [
                    {
                        type: "text",
                        value: "Another inline ref",
                    },
                ],
                id: "f5c4fee26da4a46180cef44bc019ec072ec66f3f",
            },
        ],
    })
})

it("Treats a ref without whitespace as an ID ref, not an inline ref", () => {
    // The inline-vs-ID distinction rests on the content containing a space.
    // Pinned so a future change is conscious: if write-back ever emitted an
    // inline ref whose content has no spaces, re-parsing would silently flip
    // it into an ID ref with no definition.
    expect(extractRefs(`some text{ref}single_token.{/ref}`)).toEqual({
        extractedText: `some text${idRef(1, "single_token.")}`,
        refsByFirstAppearance: new Set(["single_token."]),
        rawInlineRefs: [],
    })
})
