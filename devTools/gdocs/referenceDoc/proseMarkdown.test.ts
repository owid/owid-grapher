/*
 * Sidecar prose → uploaded Markdown: passed through as authored, except
 * that mentions resolve the way the admin links them and prose headings sit
 * under their enclosing heading. Fenced examples are never touched.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/referenceDoc/proseMarkdown.test.ts
 */

import { describe, expect, test } from "vitest"
import type { RelatedRef } from "@ourworldindata/types"
import type { DocRef } from "./model.js"
import {
    type MentionResolver,
    codeSpan,
    inlineProse,
    rewriteProse,
    tableCell,
} from "./proseMarkdown.js"

const TITLES: Record<string, string> = {
    "guide:refs": "Refs and footnotes",
    "template:article": "Article",
}
const titleFor = (ref: RelatedRef): string | undefined =>
    TITLES[`${ref.kind}:${ref.id}`]

const urlFor = (ref: DocRef): string | undefined =>
    `https://docs.google.com/document/d/${ref.kind}-${ref.id}`

/** Under --dry-run: no document URLs */
const noUrls: MentionResolver = { titleFor }
const withUrls: MentionResolver = { titleFor, urlFor }

describe("mentions", () => {
    test("without URLs: a component keeps its code form, a guide or template becomes its title", () => {
        expect(
            rewriteProse(
                "Prefer `{.callout}`, see `{guide:refs}` and `{template:article}`.",
                1,
                noUrls
            )
        ).toBe("Prefer `{.callout}`, see Refs and footnotes and Article.")
    })

    test("with URLs: each mention links to its document", () => {
        expect(
            rewriteProse("Use `{.chart}`, see `{guide:refs}`.", 1, withUrls)
        ).toBe(
            "Use [`{.chart}`](https://docs.google.com/document/d/component-chart), see [Refs and footnotes](https://docs.google.com/document/d/guide-refs)."
        )
    })

    test("a guide with an unknown title falls back to its id", () => {
        expect(rewriteProse("See `{guide:nope}`.", 1, noUrls)).toBe("See nope.")
    })

    test("plain code spans, double-backtick spans and bare ids are left alone", () => {
        const markdown = "Set `size`, write ``{.chart}`` or {.chart} bare."
        expect(rewriteProse(markdown, 1, withUrls)).toBe(markdown)
    })
})

describe("headings", () => {
    test("under an H2, a prose `##` becomes H3 and `###` H4", () => {
        expect(
            rewriteProse("## Limitations\n\nText.\n\n### Detail", 2, noUrls)
        ).toBe("### Limitations\n\nText.\n\n#### Detail")
    })

    test("a stray `#` counts as `##`; nothing goes deeper than `####`", () => {
        expect(rewriteProse("# Top", 2, noUrls)).toBe("### Top")
        // Under a document's H1 title, a sidecar `##` stays an H2
        expect(rewriteProse("## Limitations", 1, noUrls)).toBe("## Limitations")
        expect(rewriteProse("## Deep\n#### Deeper", 3, noUrls)).toBe(
            "#### Deep\n#### Deeper"
        )
    })

    test("a heading indented by up to three spaces is demoted, its indent kept", () => {
        expect(rewriteProse("  ## Indented", 2, noUrls)).toBe("  ### Indented")
    })

    test("a heading's mentions resolve too", () => {
        expect(rewriteProse("## About `{guide:refs}`", 2, noUrls)).toBe(
            "### About Refs and footnotes"
        )
    })
})

describe("fences", () => {
    test("headings and mentions inside fences are untouched, indented fences included", () => {
        const markdown = [
            "Intro `{.chart}`.",
            "",
            "```archie",
            "## not a heading",
            "`{.chart}`",
            "```",
            "",
            "- A list item:",
            "  ```",
            "  ## still code `{guide:refs}`",
            "  ```",
            "",
            "## After",
        ].join("\n")
        expect(rewriteProse(markdown, 2, noUrls)).toBe(
            [
                "Intro `{.chart}`.",
                "",
                "```archie",
                "## not a heading",
                "`{.chart}`",
                "```",
                "",
                "- A list item:",
                "  ```",
                "  ## still code `{guide:refs}`",
                "  ```",
                "",
                "### After",
            ].join("\n")
        )
    })
})

describe(inlineProse, () => {
    test("resolves mentions and puts the prose on one line", () => {
        expect(
            inlineProse("Names; see\n`{guide:refs}`.\n\nMore.", withUrls)
        ).toBe(
            "Names; see [Refs and footnotes](https://docs.google.com/document/d/guide-refs). More."
        )
    })
})

describe(tableCell, () => {
    test("escapes pipes, also inside code spans, and joins lines", () => {
        expect(tableCell('`"a" | "b"` or\nnone')).toBe('`"a" \\| "b"` or none')
        expect(tableCell("a \\| b")).toBe("a \\| b")
    })
})

describe(codeSpan, () => {
    test("wraps in backticks, with a longer delimiter around a backtick", () => {
        expect(codeSpan("{.chart}")).toBe("`{.chart}`")
        expect(codeSpan("a`b")).toBe("`` a`b ``")
        expect(codeSpan("a``b`")).toBe("``` a``b` ```")
    })
})
