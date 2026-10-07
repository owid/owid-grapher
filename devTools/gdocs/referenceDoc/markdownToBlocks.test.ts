/*
 * Sidecar Markdown → blocks: no Markdown syntax survives, mentions resolve
 * the way the admin links them, prose headings sit under their enclosing one.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/referenceDoc/markdownToBlocks.test.ts
 */

import { describe, expect, test } from "vitest"
import type { RelatedRef } from "@ourworldindata/types"
import type { DocRef } from "./model.js"
import { inlineMarkdownToRuns, markdownToBlocks } from "./markdownToBlocks.js"

const TITLES: Record<string, string> = {
    "guide:refs": "Refs and footnotes",
    "template:article": "Article",
}
const titleFor = (ref: RelatedRef): string | undefined =>
    TITLES[`${ref.kind}:${ref.id}`]

const urlFor = (ref: DocRef): string | undefined =>
    ref.id === "nope"
        ? undefined
        : `https://docs.google.com/${ref.kind}/${ref.id}`

const parse = (markdown: string, baseLevel: 1 | 2 | 3 | 4 = 2) =>
    markdownToBlocks(markdown, { baseLevel, titleFor })

describe(markdownToBlocks, () => {
    test("a component mention stays in its ArchieML form, in monospace", () => {
        expect(parse("Prefer `{.callout}` here.")).toEqual([
            {
                type: "paragraph",
                runs: [
                    { text: "Prefer " },
                    { text: "{.callout}", code: true },
                    { text: " here." },
                ],
            },
        ])
    })

    test("guide and template mentions become the target's title in plain text", () => {
        expect(parse("See `{guide:refs}` and `{template:article}`.")).toEqual([
            {
                type: "paragraph",
                runs: [{ text: "See Refs and footnotes and Article." }],
            },
        ])
    })

    test("an unknown guide mention falls back to its id", () => {
        expect(parse("See `{guide:nope}`.")).toEqual([
            { type: "paragraph", runs: [{ text: "See nope." }] },
        ])
    })

    test("with urlFor, mentions link to their document; a component keeps its monospace tag", () => {
        expect(
            markdownToBlocks("Use `{.chart}`, see `{guide:refs}`.", {
                baseLevel: 2,
                titleFor,
                urlFor,
            })
        ).toEqual([
            {
                type: "paragraph",
                runs: [
                    { text: "Use " },
                    {
                        text: "{.chart}",
                        code: true,
                        link: "https://docs.google.com/component/chart",
                    },
                    { text: ", see " },
                    {
                        text: "Refs and footnotes",
                        link: "https://docs.google.com/guide/refs",
                    },
                    { text: "." },
                ],
            },
        ])
    })

    test("with urlFor, an unknown id still gets no link; plain code spans never do", () => {
        expect(
            markdownToBlocks("See `{guide:nope}` and `url`.", {
                baseLevel: 2,
                titleFor,
                urlFor,
            })
        ).toEqual([
            {
                type: "paragraph",
                runs: [
                    { text: "See nope and " },
                    { text: "url", code: true },
                    { text: "." },
                ],
            },
        ])
    })

    test("other code spans are monospace runs; bold, italic and links keep their style", () => {
        expect(
            parse(
                "Set `size` to **wide** or _narrow_, see [docs](https://x.y/z)."
            )
        ).toEqual([
            {
                type: "paragraph",
                runs: [
                    { text: "Set " },
                    { text: "size", code: true },
                    { text: " to " },
                    { text: "wide", bold: true },
                    { text: " or " },
                    { text: "narrow", italic: true },
                    { text: ", see " },
                    { text: "docs", link: "https://x.y/z" },
                    { text: "." },
                ],
            },
        ])
    })

    test("a fenced example becomes a code block without its fence markers", () => {
        const markdown = "Intro.\n\n```archie\n{.chart}\nurl: x\n{}\n```"
        expect(parse(markdown)).toEqual([
            { type: "paragraph", runs: [{ text: "Intro." }] },
            { type: "code", text: "{.chart}\nurl: x\n{}" },
        ])
    })

    test("soft line breaks inside a paragraph or bullet are spaces", () => {
        expect(
            parse("One line\nwrapped here.\n\n- A bullet\n  wrapped too.")
        ).toEqual([
            { type: "paragraph", runs: [{ text: "One line wrapped here." }] },
            { type: "bullets", items: [[{ text: "A bullet wrapped too." }]] },
        ])
    })

    test("prose headings are demoted below the enclosing heading", () => {
        const markdown = "## Limitations\n\n### Detail\n\nText."
        expect(parse(markdown, 2).filter((b) => b.type === "heading")).toEqual([
            { type: "heading", level: 3, text: "Limitations" },
            { type: "heading", level: 4, text: "Detail" },
        ])
        // Under a deeper heading: ## → H4, ### stays at H4
        expect(parse(markdown, 3).filter((b) => b.type === "heading")).toEqual([
            { type: "heading", level: 4, text: "Limitations" },
            { type: "heading", level: 4, text: "Detail" },
        ])
    })

    test("a heading resolves mentions like a paragraph does", () => {
        expect(parse("## Using `{guide:refs}` and `url`")).toEqual([
            {
                type: "heading",
                level: 3,
                text: "Using Refs and footnotes and url",
            },
        ])
    })

    test("a stray # heading counts as ##, never outranking the enclosing heading", () => {
        expect(parse("# Top\n\n## Next", 2)).toEqual([
            { type: "heading", level: 3, text: "Top" },
            { type: "heading", level: 3, text: "Next" },
        ])
    })

    test("raw HTML is dropped, block-level and inline", () => {
        expect(parse("<!-- note -->\n\nKeep <b>this</b> text.")).toEqual([
            { type: "paragraph", runs: [{ text: "Keep this text." }] },
        ])
    })

    test("ordered and nested lists flatten to bullets", () => {
        expect(parse("1. First\n2. Second\n   - nested")).toEqual([
            {
                type: "bullets",
                items: [
                    [{ text: "First" }],
                    [{ text: "Second" }],
                    [{ text: "nested" }],
                ],
            },
        ])
    })
})

describe(inlineMarkdownToRuns, () => {
    test("renders a one-line description with its code spans and mentions", () => {
        expect(
            inlineMarkdownToRuns("Names; see `{guide:refs}` and `url`.", {
                titleFor,
            })
        ).toEqual([
            { text: "Names; see Refs and footnotes and " },
            { text: "url", code: true },
            { text: "." },
        ])
    })
})
