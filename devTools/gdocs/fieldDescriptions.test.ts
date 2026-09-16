import { describe, expect, test } from "vitest"
import { parseFieldDescriptions } from "./fieldDescriptions.js"

function parse(text: string): Map<string, string> {
    return parseFieldDescriptions(text, "Sidecar.md")
}

describe("the field description bullets", () => {
    test("reads one description per bullet", () => {
        expect([
            ...parse(
                "- `size`: How wide the chart renders.\n- `url`: Where it points."
            ),
        ]).toEqual([
            ["size", "How wide the chart renders."],
            ["url", "Where it points."],
        ])
    })

    test("joins indented continuation lines onto the description", () => {
        expect(
            parse(
                "- `size`: How wide it renders,\n    measured in columns."
            ).get("size")
        ).toBe("How wide it renders, measured in columns.")
    })

    test("ends a description at a non-indented line", () => {
        const descriptions = parse(
            "- `size`: How wide it renders.\n\nSome prose.\n    Indented, but no longer a continuation."
        )
        expect(descriptions.get("size")).toBe("How wide it renders.")
    })

    test("ignores prose that is not a bullet", () => {
        expect(parse("These are the properties:\n\nNothing here.").size).toBe(0)
    })

    // Both are drift the generator exists to catch: a rename leaving two
    // bullets behind, or a bullet whose text was never written.
    test("rejects a duplicate field", () => {
        expect(() => parse("- `size`: One.\n- `size`: Two.")).toThrow(
            'Duplicate field description for "size" in Sidecar.md'
        )
    })

    test.each(["- `size`:", "- `size`:   "])(
        "rejects %s as an empty description",
        (line) => {
            expect(() => parse(line)).toThrow("has no description")
        }
    )

    test("names the file in its errors", () => {
        expect(() => parse("- `size`:")).toThrow("Sidecar.md")
    })
})
