/*
 * The sidecar section vocabulary: what splits, and what fails loudly.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/sidecarSections.test.ts
 */

import { describe, expect, test } from "vitest"
import { splitSidecarProse } from "./sidecarSections.js"

const FILE = "Example.md"

function split(body: string, kind: "component" | "template" = "component") {
    return splitSidecarProse(body, FILE, kind)
}

describe("the sidecar section split", () => {
    test("splits the intro, the decision prose and the properties section", () => {
        const { prose, properties } = split(
            [
                "An example block.",
                "## When to use",
                "- To show something.",
                "## When NOT to use",
                "- Prefer {.other-block} for prose.",
                "## Properties",
                "- `size`: How wide it renders.",
            ].join("\n\n")
        )
        expect(prose.intro).toBe("An example block.")
        expect(prose.whenToUse).toBe("- To show something.")
        expect(prose.whenNotToUse).toBe("- Prefer {.other-block} for prose.")
        expect(prose.notes).toBeUndefined()
        expect(properties).toBe("- `size`: How wide it renders.")
    })

    test("matches headings past casing and punctuation", () => {
        const { prose } = split("Intro.\n\n## when NOT to USE:\n\n- Never.")
        expect(prose.whenNotToUse).toBe("- Never.")
    })

    test("drops the Notes heading and keeps free-section headings", () => {
        const { prose } = split(
            [
                "Intro.",
                "## When to use",
                "- Always.",
                "## Notes",
                "A caveat.",
                "## Limitations",
                "Only two per page.",
            ].join("\n\n")
        )
        expect(prose.notes).toBe(
            "A caveat.\n\n## Limitations\n\nOnly two per page."
        )
    })

    // The failure mode the split used to have: an unrecognized heading was
    // silently treated as free prose, so the decision box just went missing.
    test.each([
        ["## When to use it", "When to use"],
        ["## When to use this block", "When to use"],
        ["## When not to use it", "When NOT to use"],
        ["## Propertes", "Properties"],
        ["## Note", "Notes"],
    ])("rejects %s as a near miss", (heading, suggestion) => {
        expect(() => split("Intro.\n\n" + heading + "\n\nSomething.")).toThrow(
            'did you mean "## ' + suggestion + '"?'
        )
    })

    test("lets genuinely different sections through as free prose", () => {
        const { prose } = split(
            "Intro.\n\n## When to use\n\n- Always.\n\n## Variations\n\nTwo of them."
        )
        expect(prose.notes).toBe("## Variations\n\nTwo of them.")
    })

    test("rejects a properties section in a template sidecar", () => {
        expect(() =>
            split("Intro.\n\n## Properties\n\n- `a`: b.", "template")
        ).toThrow("belongs in a component sidecar")
    })

    test("rejects a repeated section", () => {
        expect(() =>
            split("Intro.\n\n## Notes\n\nOne.\n\n## Notes\n\nTwo.")
        ).toThrow("more than one")
    })

    test("rejects an empty section", () => {
        expect(() =>
            split("Intro.\n\n## When to use\n\n## Notes\n\nOne.")
        ).toThrow("is empty")
    })

    // A subsection used to be relocated into the notes area behind the
    // author's back — now they are told to promote it.
    test("rejects a subsection inside a section", () => {
        expect(() =>
            split(
                "Intro.\n\n## When to use\n\n- Always.\n\n### Example\n\nHere."
            )
        ).toThrow('promote the subsection to its own "## " section')
    })

    test("rejects a sidecar with no intro", () => {
        expect(() => split("## When to use\n\n- Always.")).toThrow(
            "has no intro"
        )
    })
})
