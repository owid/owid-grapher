import { expect, it } from "vitest"

import { extractRefs } from "./archieToEnriched.js"

it("Can extract a ref from some text", () => {
    expect(
        extractRefs(`I am a thing{ref}some_id{/ref} and some follow up`)
    ).toEqual({
        extractedText: `I am a thing<a class="ref" href="#note-1"><sup>1</sup></a> and some follow up`,
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
        extractedText: `I am a thing<a class="ref" href="#note-1"><sup>1</sup></a> and some follow up<a class="ref" href="#note-2"><sup>2</sup></a>`,
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
        extractedText: `I am a thing<a class="ref" href="#note-1"><sup>1</sup></a> and some follow up<a class="ref" href="#note-2"><sup>2</sup></a>. I refer to a ref that has already been referenced once<a class="ref" href="#note-1"><sup>1</sup></a>`,
        refsByFirstAppearance: new Set(["some_id", "another_id"]),
        rawInlineRefs: [],
    })
})

it("Can extract an inline ref", () => {
    expect(extractRefs(`I am a thing{ref}I am an inline ref{/ref}`)).toEqual({
        extractedText: `I am a thing<a class="ref" href="#note-1"><sup>1</sup></a>`,
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
        extractedText: `I am a thing<a class="ref" href="#note-1"><sup>1</sup></a> and another thing<a class="ref" href="#note-2"><sup>2</sup></a>`,
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
        extractedText: `I am a thing<a class="ref" href="#note-1"><sup>1</sup></a> and another thing<a class="ref" href="#note-2"><sup>2</sup></a> and me again<a class="ref" href="#note-1"><sup>1</sup></a>`,
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

it("Can index intermingled inline and ID refs correctly", () => {
    expect(
        extractRefs(
            `I am a thing{ref}some_id{/ref} and another thing{ref}An inline ref{/ref} with more {ref}another_id{/ref} and even more{ref}Another inline ref{/ref}`
        )
    ).toEqual({
        extractedText: `I am a thing<a class="ref" href="#note-1"><sup>1</sup></a> and another thing<a class="ref" href="#note-2"><sup>2</sup></a> with more <a class="ref" href="#note-3"><sup>3</sup></a> and even more<a class="ref" href="#note-4"><sup>4</sup></a>`,
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
