import { extractRefs } from "./archieToEnriched.js"

it("Can extract a ref from some text", () => {
    expect(
        extractRefs(`I am a thing{ref}some_id{/ref} and some follow up`)
    ).toEqual({
        extractedText: `I am a thing<a class="ref" href="#note-1"><sup>1</sup></a> and some follow up`,
        refsByFirstAppearance: new Set(["some_id"]),
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
    })
})
