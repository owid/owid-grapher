/*
 * Fenced examples are identified by where they sit, not by their text.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/sidecarExamples.test.ts
 */

import { describe, expect, test } from "vitest"
import {
    assertWellFormedFences,
    harvestExamples,
    hasFence,
} from "./sidecarExamples.js"

const fence = (lang: string, body: string): string =>
    "```" + lang + "\n" + body + "\n```"

describe(harvestExamples, () => {
    test("records flavour, section and position for every fence", () => {
        const examples = harvestExamples({
            intro: ["Intro.", fence("archie", "{.chart}\n{}")].join("\n\n"),
            notes: [
                "## Form A",
                fence("archie", "{.image}\n{}"),
                "## Form B",
                fence("archie-document", "type: article\n[+body]\nHi\n[]"),
            ].join("\n\n"),
        })
        expect(examples).toEqual([
            {
                archie: "{.chart}\n{}",
                flavour: "archie",
                section: "intro",
                position: 0,
            },
            {
                archie: "{.image}\n{}",
                flavour: "archie",
                section: "notes",
                position: 0,
            },
            {
                archie: "type: article\n[+body]\nHi\n[]",
                flavour: "archie-document",
                section: "notes",
                position: 1,
            },
        ])
    })

    test("keeps two fences with identical source and different flavours apart", () => {
        const source = "{.chart}\nurl: https://ourworldindata.org/grapher/x\n{}"
        const examples = harvestExamples({
            intro: [
                fence("archie", source),
                fence("archie-document", source),
            ].join("\n\n"),
        })
        expect(examples.map((e) => [e.flavour, e.position])).toEqual([
            ["archie", 0],
            ["archie-document", 1],
        ])
    })

    test("ignores fences in other languages", () => {
        expect(harvestExamples({ intro: fence("yaml", "title: x") })).toEqual(
            []
        )
        expect(hasFence("Text\n\n" + fence("yaml", "a: b"))).toBe(true)
        expect(hasFence("No fences here")).toBe(false)
    })

    test("tolerates trailing spaces and tabs on the info line", () => {
        const examples = harvestExamples({
            intro: [
                "```archie \n{.chart}\n{}\n```",
                "\n\n```archie-document\t\ntype: article\n{}\n```",
            ].join(""),
        })
        expect(examples.map((e) => [e.flavour, e.archie])).toEqual([
            ["archie", "{.chart}\n{}"],
            ["archie-document", "type: article\n{}"],
        ])
    })
})

describe(assertWellFormedFences, () => {
    test("accepts balanced archie and archie-document fences", () => {
        expect(() =>
            assertWellFormedFences(
                [
                    "Intro.",
                    fence("archie", "{.chart}\n{}"),
                    "More.",
                    fence("archie-document", "type: article"),
                ].join("\n\n"),
                "sidecar.md"
            )
        ).not.toThrow()
    })

    test("rejects an unterminated fence", () => {
        expect(() =>
            assertWellFormedFences("```archie\n{.chart}\n{}\n", "sidecar.md")
        ).toThrow(/unterminated code fence/)
    })

    test("rejects a fence in another language", () => {
        expect(() =>
            assertWellFormedFences(fence("yaml", "a: b"), "sidecar.md")
        ).toThrow(/unsupported language "yaml"/)
    })

    test("tolerates trailing whitespace on the info line", () => {
        expect(() =>
            assertWellFormedFences(
                "```archie \n{.chart}\n{}\n```",
                "sidecar.md"
            )
        ).not.toThrow()
    })

    test("tolerates CRLF line endings", () => {
        expect(() =>
            assertWellFormedFences(
                "Intro.\r\n\r\n```archie\r\n{.chart}\r\n{}\r\n```\r\n",
                "sidecar.md"
            )
        ).not.toThrow()
    })
})
