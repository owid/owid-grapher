import { expect, it, describe } from "vitest"
import {
    buildAddComponentPrompt,
    buildNewDocPrompt,
} from "./gdocsReferencePrompt.js"

describe(buildAddComponentPrompt, () => {
    const archie = "{.image}\nfilename: example.png\n{}"
    const prompt = buildAddComponentPrompt("image", archie)

    it("names the component tag and targets the doc in progress", () => {
        expect(prompt).toContain("{.image}")
        expect(prompt).toContain("OWID Google Doc I'm working on")
    })

    it("triggers the gdoc-editor skill by name", () => {
        expect(prompt).toContain("gdoc-editor")
    })

    it("marks the snippet as an adaptable example and includes it verbatim", () => {
        expect(prompt).toContain("adapt")
        expect(prompt).toContain(archie)
    })
})

describe(buildNewDocPrompt, () => {
    const prompt = buildNewDocPrompt("data-insight", "Data insight")

    it("asks for a new doc of the template's type via the gdoc-editor skill", () => {
        expect(prompt).toContain("new OWID data insight")
        expect(prompt).toContain("Google Doc")
        expect(prompt).toContain("gdoc-editor")
    })

    it("points at the templates.json entry instead of duplicating it", () => {
        expect(prompt).toContain("templates.json")
        expect(prompt).toContain("type: data-insight")
    })
})
