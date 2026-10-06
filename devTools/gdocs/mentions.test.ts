/*
 * Cross-reference mentions: `{.id}`, `{guide:id}`, `{template:id}` — only
 * as the entire content of an inline code span, never inside a fence.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/mentions.test.ts
 */

import { describe, expect, test } from "vitest"
import {
    findBareKnownIds,
    harvestMentions,
    resolveMentions,
    type KnownIds,
} from "./mentions.js"

const code = (s: string): string => "`" + s + "`"

describe(harvestMentions, () => {
    test("recognises the three forms inside code spans, once each", () => {
        const text = [
            "Prefer " + code("{.callout}") + " for notes.",
            "See " +
                code("{guide:refs}") +
                " and " +
                code("{template:article}") +
                ".",
            "Again " + code("{.callout}") + ".",
        ].join("\n")
        expect(harvestMentions([text])).toEqual([
            { kind: "component", id: "callout" },
            { kind: "guide", id: "refs" },
            { kind: "template", id: "article" },
        ])
    })

    test("ignores a bare mention outside a code span", () => {
        expect(harvestMentions(["Use {.callout} here."])).toEqual([])
    })

    test("ignores mentions inside fenced examples", () => {
        const text =
            "```archie\n{.callout}\ntitle: `{.chart}`\n{}\n```\n\nSee `{.image}`."
        expect(harvestMentions([text])).toEqual([
            { kind: "component", id: "image" },
        ])
    })

    test("skips undefined sections", () => {
        expect(harvestMentions([undefined, "`{guide:refs}`"])).toEqual([
            { kind: "guide", id: "refs" },
        ])
    })

    test("ignores a mention inside a doubled-backtick span, unlike a single-backtick one", () => {
        const text = "``{.chart}`` but " + code("{.callout}") + " counts."
        expect(harvestMentions([text])).toEqual([
            { kind: "component", id: "callout" },
        ])
    })
})

describe(findBareKnownIds, () => {
    const known: KnownIds = {
        component: new Set(["chart", "dual"]),
        guide: new Set(["refs", "dual"]),
        template: new Set(["data-insight", "dual"]),
    }

    test("finds a bare id known as a template", () => {
        expect(
            findBareKnownIds(
                ["Prefer " + code("data-insight") + " for short updates."],
                known
            )
        ).toEqual([{ kind: "template", id: "data-insight" }])
    })

    test("finds a bare id known as a component", () => {
        expect(
            findBareKnownIds(["Use " + code("chart") + " instead."], known)
        ).toEqual([{ kind: "component", id: "chart" }])
    })

    test("finds a bare id known as a guide", () => {
        expect(
            findBareKnownIds(["See " + code("refs") + " for footnotes."], known)
        ).toEqual([{ kind: "guide", id: "refs" }])
    })

    test("ignores an unknown word in backticks", () => {
        expect(findBareKnownIds([code("not-a-known-id")], known)).toEqual([])
    })

    test("ignores a doubled-backtick span", () => {
        expect(
            findBareKnownIds(["``chart`` but not a mention"], known)
        ).toEqual([])
    })

    test("ignores content inside a fenced block", () => {
        expect(
            findBareKnownIds(["```archie\n" + code("chart") + "\n```"], known)
        ).toEqual([])
    })

    test("ignores mention syntax, which is not bare", () => {
        expect(findBareKnownIds([code("{.chart}")], known)).toEqual([])
    })

    test("prefers component over template over guide when an id is known as more than one kind", () => {
        expect(findBareKnownIds([code("dual")], known)).toEqual([
            { kind: "component", id: "dual" },
        ])
    })
})

describe(resolveMentions, () => {
    const known: KnownIds = {
        component: new Set(["callout", "chart"]),
        guide: new Set(["refs"]),
        template: new Set(["article"]),
    }

    test("passes known ids through and drops the self-reference", () => {
        expect(
            resolveMentions(
                [
                    { kind: "component", id: "callout" },
                    { kind: "guide", id: "refs" },
                ],
                known,
                "guides/refs.md",
                { kind: "guide", id: "refs" }
            )
        ).toEqual([{ kind: "component", id: "callout" }])
    })

    test("fails naming the file and the id", () => {
        expect(() =>
            resolveMentions([{ kind: "guide", id: "nope" }], known, "Text.md")
        ).toThrow('Text.md: mentions unknown guide "{guide:nope}"')
    })
})
